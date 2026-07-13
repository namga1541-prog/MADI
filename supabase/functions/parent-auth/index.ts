/**
 * /parent-auth — 학부모 자동 가입 Edge Function
 *
 * 보안:
 * - 전화번호 조회 Rate Limiting: 동일 IP 분당 5회, 시간당 20회 제한
 * - 전화번호 포맷 서버 검증
 * - 아동 조회: PostgREST JSONB 필터 (limit 없음, 서버 측 필터링)
 * - 아동 정보 최소한만 반환 (childId·이름만 — center_id 미노출)
 * - 회원가입 시 bcrypt(cost=12) 해싱 — 첫 로그인부터 강력 해시 보장
 * - signup 시 phone-child 매핑 재검증 (임의 childId 주입 방지)
 * - CORS: 'null' Origin 제거 (sandboxed iframe CSRF 방지)
 *
 * action: 'lookup'  — 전화번호로 아동 조회 + 중복 계정 확인
 * action: 'signup'  — 학부모 계정 생성 + madi_parent_children 연결
 */

import bcrypt from "npm:bcryptjs@2.4.3"
import { getClientIp, fetchWithTimeout } from '../_shared/auth.ts'

// 외부 fetch 타임아웃: Supabase REST/RPC 는 8s.
const SUPA_TIMEOUT_MS = 8000

const ALLOWED_ORIGINS = new Set([
  'https://namga1541-prog.github.io',
  'http://localhost:3000',
  'http://127.0.0.1:3000',
])

function makeCORS(origin: string | null): Record<string, string> {
  const o = origin ?? ''
  const acao = ALLOWED_ORIGINS.has(o) ? o : 'https://namga1541-prog.github.io'
  return {
    'Access-Control-Allow-Origin':      acao,
    'Access-Control-Allow-Headers':     'content-type',
    'Access-Control-Allow-Methods':     'POST, OPTIONS',
    'Access-Control-Allow-Credentials': 'true',
    'Vary': 'Origin',
  }
}

// ── Rate Limit (DB 기반: madi_rate_limits 테이블) ─────────────────────────
// 사전 적용 필요: rate_limits_setup.sql
// 메모리 fallback 은 DB 호출 실패 시에만 사용 (cold-start 보호용)
const memFallback = new Map<string, { count: number; windowStart: number; hourCount: number; hourStart: number }>()

// 전화번호 enumeration(가입여부·아동명 oracle) 완화 — 무인증 lookup 이라 보수적으로.
const RATE_PER_MINUTE = 3
const RATE_PER_HOUR   = 10

async function checkRateLimit(
  key: string,
  supabaseUrl: string,
  serviceKey: string,
): Promise<{ allowed: boolean; retryAfter?: number }> {
  const now = Date.now()
  const minMs  = 60 * 1000
  const hourMs = 60 * 60 * 1000

  // RPC 호출 — DB가 단일 트랜잭션으로 카운트 증가 + 반환
  try {
    const r = await fetchWithTimeout(`${supabaseUrl}/rest/v1/rpc/madi_rate_limit_hit`, {
      method:  'POST',
      headers: {
        'Authorization': `Bearer ${serviceKey}`,
        'apikey':        serviceKey,
        'Content-Type':  'application/json',
      },
      body: JSON.stringify({ p_key: key, p_min_window_ms: minMs, p_hour_window_ms: hourMs }),
    }, SUPA_TIMEOUT_MS)
    if (r.ok) {
      const d = await r.json() as { count: number; hour_count: number; window_start: string; hour_start: string }
      if (d.count > RATE_PER_MINUTE) {
        const winStart = new Date(d.window_start).getTime()
        return { allowed: false, retryAfter: Math.max(1, Math.ceil((winStart + minMs - now) / 1000)) }
      }
      if (d.hour_count > RATE_PER_HOUR) {
        const hourStart = new Date(d.hour_start).getTime()
        return { allowed: false, retryAfter: Math.max(1, Math.ceil((hourStart + hourMs - now) / 1000)) }
      }
      return { allowed: true }
    }
    console.warn('[rate-limit] RPC failed status=%d, fallback to memory', r.status)
  } catch (e) {
    console.warn('[rate-limit] RPC error, fallback to memory:', (e as Error).message)
  }

  // ── DB 실패 시 메모리 fallback ──
  let entry = memFallback.get(key)
  if (!entry) entry = { count: 0, windowStart: now, hourCount: 0, hourStart: now }
  if (now - entry.windowStart > minMs)  { entry.count = 0;     entry.windowStart = now }
  if (now - entry.hourStart   > hourMs) { entry.hourCount = 0; entry.hourStart   = now }
  entry.count++; entry.hourCount++
  memFallback.set(key, entry)
  if (entry.count     > RATE_PER_MINUTE) return { allowed: false, retryAfter: Math.ceil((entry.windowStart + minMs  - now) / 1000) }
  if (entry.hourCount > RATE_PER_HOUR)   return { allowed: false, retryAfter: Math.ceil((entry.hourStart   + hourMs - now) / 1000) }
  return { allowed: true }
}

// ── 전화번호 포맷 검증 ────────────────────────────────────────────────────
function validatePhone(phone: string): boolean {
  const cleaned = phone.replace(/[^0-9]/g, '')
  return cleaned.length === 11 && cleaned.startsWith('010')
}

// ── [PIPA] 학부모 가입 동의 증빙 (best-effort) ───────────────────────────
//   가입 성공 시 madi_audit_log 에 동의 1행 append-only 기록.
//   ⚠️ madi_audit_log 실제 컬럼만 사용(SCHEMA.md): actor_id, actor_role, action,
//      table_name, row_id, center_id. (record_id/actor_name 컬럼 없음.)
//   version·sensitive 여부는 row_id 에 packing — 스키마 변경 없음.
//   try/catch 로 감싸 로깅 실패해도 가입 본 요청에는 영향 없음.
async function logParentConsent(
  supabaseUrl: string,
  serviceKey: string,
  fields: { actorId: string; centerId: string; version: string; sensitive: boolean; agreed: boolean },
): Promise<void> {
  try {
    await fetchWithTimeout(`${supabaseUrl}/rest/v1/madi_audit_log`, {
      method:  'POST',
      headers: {
        'Authorization': `Bearer ${serviceKey}`,
        'apikey':        serviceKey,
        'Content-Type':  'application/json',
        'Prefer':        'return=minimal',
      },
      body: JSON.stringify({
        actor_id:   fields.actorId,
        actor_role: 'parent',
        action:     'consent_signup',
        table_name: 'consent',
        row_id:     'v' + fields.version + '|sensitive:' + fields.sensitive + '|agreed:' + fields.agreed,
        center_id:  fields.centerId || null,
      }),
    }, SUPA_TIMEOUT_MS)
  } catch (_) { /* best-effort 증빙 */ }
}

// ── 메인 핸들러 ──────────────────────────────────────────────────────────
Deno.serve(async (req: Request) => {
  const origin = req.headers.get('origin')
  const cors   = makeCORS(origin)

  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: cors })
  }
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method Not Allowed' }), {
      status: 405, headers: { ...cors, 'Content-Type': 'application/json' }
    })
  }

  const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? ''
  const SERVICE_KEY  = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''

  // env 가드 — URL/SERVICE_KEY 미설정(빈 문자열)이면 모든 DB 호출이 무의미하게 실패하므로
  //   다른 함수(ai-proxy 등)와 동일하게 진입부에서 명시적으로 500 차단.
  if (!SUPABASE_URL || !SERVICE_KEY) {
    return new Response(JSON.stringify({ error: '서버 설정 오류' }), {
      status: 500, headers: { ...cors, 'Content-Type': 'application/json' }
    })
  }

  // IP 추출은 _shared 의 getClientIp 로 단일화 (cf-connecting-ip 우선) — login 과 동일 로직.
  const ip = getClientIp(req)

  let body: {
    action?: string; phone?: string; password?: string; childIds?: string[]
    // ★ 신원 확인 요소 — lookup/signup 모두 아동 이름+생년월일 대조로 '번호만 알면 통과'를 차단.
    childName?: string; birth?: string; verifyName?: string; verifyBirth?: string
    consent?: { agreed?: unknown; sensitive?: unknown; version?: unknown }
  }
  try {
    body = await req.json()
  } catch {
    return new Response(JSON.stringify({ error: '요청 형식 오류' }), {
      status: 400, headers: { ...cors, 'Content-Type': 'application/json' }
    })
  }

  const { action, phone } = body

  // ─────────────────────────────────────────────────────────────────
  // action: lookup — 전화번호로 아동 조회 + 중복 계정 확인
  // ─────────────────────────────────────────────────────────────────
  if (action === 'lookup') {
    const rateCheck = await checkRateLimit(`lookup:${ip}`, SUPABASE_URL, SERVICE_KEY)
    if (!rateCheck.allowed) {
      return new Response(JSON.stringify({
        error: `요청이 너무 많습니다. ${rateCheck.retryAfter}초 후 다시 시도해주세요.`
      }), {
        status: 429,
        headers: { ...cors, 'Content-Type': 'application/json', 'Retry-After': String(rateCheck.retryAfter ?? 60) }
      })
    }

    if (!phone || !validatePhone(phone)) {
      return new Response(JSON.stringify({ error: '올바른 전화번호 형식이 아닙니다 (010-XXXX-XXXX)' }), {
        status: 400, headers: { ...cors, 'Content-Type': 'application/json' }
      })
    }

    // ★ [HIGH] 신원 확인 요소 필수 — 전화번호만으로는 아동 정보를 반환하지 않는다.
    //   기존엔 번호만 알면 아동 실명·childId 가 노출(enumeration oracle) + 미가입 보호자로
    //   가로채기 가입이 가능했다. 이제 이름 + 생년월일(6자리 이상)까지 대조해야 목록을 연다.
    const childName   = body.childName ? String(body.childName).trim() : ''
    const birthDigits = body.birth ? String(body.birth).replace(/[^0-9]/g, '') : ''
    if (!childName || birthDigits.length < 6) {
      return new Response(JSON.stringify({ error: '아동 이름과 생년월일을 입력해주세요' }), {
        status: 400, headers: { ...cors, 'Content-Type': 'application/json' }
      })
    }

    const cleaned   = phone.replace(/[^0-9]/g, '')
    const formatted = `${cleaned.slice(0, 3)}-${cleaned.slice(3, 7)}-${cleaned.slice(7)}`

    // 전화번호 단위 전역 카운터 — IP 회전(프록시/봇넷, x-forwarded-for 스푸핑)으로
    //   번호 enumeration(가입여부·아동명 oracle) 하는 것을 차단. IP 카운터와 병행하여
    //   같은 번호 자체에 대한 조회 상한을 둔다(IP 를 바꿔도 동일 번호는 더 못 캠).
    const phoneRate = await checkRateLimit(`lookup-phone:${cleaned}`, SUPABASE_URL, SERVICE_KEY)
    if (!phoneRate.allowed) {
      return new Response(JSON.stringify({
        error: `요청이 너무 많습니다. ${phoneRate.retryAfter}초 후 다시 시도해주세요.`
      }), {
        status: 429,
        headers: { ...cors, 'Content-Type': 'application/json', 'Retry-After': String(phoneRate.retryAfter ?? 60) }
      })
    }

    // 서버 측 JSONB 필터로 아동 조회 (limit 없이 전체 검색, 하이픈 유무 모두 대응)
    const orFilter = [
      `data->>parentPhone.eq.${cleaned}`,
      `data->>parentPhone.eq.${formatted}`,
      `data->>parent_phone.eq.${cleaned}`,
      `data->>parent_phone.eq.${formatted}`,
      `data->>phone.eq.${cleaned}`,
      `data->>phone.eq.${formatted}`,
    ].join(',')

    const childRes = await fetchWithTimeout(
      `${SUPABASE_URL}/rest/v1/madi_children?or=(${orFilter})&select=id,data`,
      { headers: { 'Authorization': `Bearer ${SERVICE_KEY}`, 'apikey': SERVICE_KEY } },
      SUPA_TIMEOUT_MS
    )
    // 조회 실패를 '아동 없음'으로 오인하면 정상 사용자에게 가입 불가 오탐 → 명시 차단(M-20)
    if (!childRes.ok) {
      console.error('parent-auth lookup childRes:', childRes.status, await childRes.text())
      return new Response(JSON.stringify({ error: '일시적인 오류가 발생했습니다. 잠시 후 다시 시도해주세요.' }), {
        status: 503, headers: { ...cors, 'Content-Type': 'application/json' }
      })
    }
    const children = await childRes.json()
    const childArr = Array.isArray(children) ? children : []

    // ★ 신원 확인 게이트 — 이 번호의 아동 중 (이름 + 생년월일)이 일치하는 아동이 하나라도
    //   있어야만 목록을 반환한다. 불일치 시 '아동 없음'과 구분 불가한 빈 응답(oracle 차단).
    //   형제(다자녀)는 한 명의 신원만 증명하면 같은 보호자 번호이므로 전원 반환.
    const identityOk = childArr.some((c: any) => {
      const nm = String((c.data || {}).name || '').trim()
      const bd = String((c.data || {}).birth || '').replace(/[^0-9]/g, '')
      return nm !== '' && nm === childName && bd.length >= 6 && bd === birthDigits
    })
    if (!identityOk) {
      // User Enumeration 방지: 불일치도 '없음'과 동일한 빈 응답
      return new Response(JSON.stringify({ children: [] }), {
        status: 200, headers: { ...cors, 'Content-Type': 'application/json' }
      })
    }

    // 신원 확인 통과 후에만 '이미 가입됨' 상태를 노출 (가입여부 oracle 도 게이트 뒤로).
    const existRes  = await fetchWithTimeout(
      `${SUPABASE_URL}/rest/v1/madi_users?username=eq.${cleaned}&role=eq.parent&select=id`,
      { headers: { 'Authorization': `Bearer ${SERVICE_KEY}`, 'apikey': SERVICE_KEY } },
      SUPA_TIMEOUT_MS
    )
    // DB 조회 실패(4xx/5xx)를 '미가입'으로 오인하지 않도록 명시 차단(M-20)
    if (!existRes.ok) {
      console.error('parent-auth lookup existRes:', existRes.status, await existRes.text())
      return new Response(JSON.stringify({ error: '일시적인 오류가 발생했습니다. 잠시 후 다시 시도해주세요.' }), {
        status: 503, headers: { ...cors, 'Content-Type': 'application/json' }
      })
    }
    const existData = await existRes.json()
    if (Array.isArray(existData) && existData.length > 0) {
      // alreadyJoined: true — 클라이언트가 로그인 화면으로 안내
      return new Response(JSON.stringify({ children: [], alreadyJoined: true }), {
        status: 200, headers: { ...cors, 'Content-Type': 'application/json' }
      })
    }

    // 최소 정보만 반환 — center_id 미노출
    const matched = childArr.map((c: any) => ({
      childId: c.id,
      name:    (c.data || {}).name || '이름 없음',
    }))

    return new Response(JSON.stringify({ children: matched }), {
      status: 200, headers: { ...cors, 'Content-Type': 'application/json' }
    })
  }

  // ─────────────────────────────────────────────────────────────────
  // action: signup — 학부모 계정 생성
  // ─────────────────────────────────────────────────────────────────
  if (action === 'signup') {
    const rateCheck = await checkRateLimit(`signup:${ip}`, SUPABASE_URL, SERVICE_KEY)
    if (!rateCheck.allowed) {
      return new Response(JSON.stringify({
        error: `요청이 너무 많습니다. ${rateCheck.retryAfter}초 후 다시 시도해주세요.`
      }), {
        status: 429,
        headers: { ...cors, 'Content-Type': 'application/json', 'Retry-After': String(rateCheck.retryAfter ?? 60) }
      })
    }

    const signupPhone = body.phone
    const password    = body.password
    const childIds    = body.childIds

    if (!signupPhone || !password || !Array.isArray(childIds) || childIds.length === 0) {
      return new Response(JSON.stringify({ error: '필수 항목 누락 (phone, password, childIds)' }), {
        status: 400, headers: { ...cors, 'Content-Type': 'application/json' }
      })
    }

    // 비밀번호 최소 4자, 최대 128자 (베타 기간 — 정식 배포 시 8자로 변경)
    if (password.length < 4) {
      return new Response(JSON.stringify({ error: '비밀번호는 4자 이상이어야 합니다' }), {
        status: 400, headers: { ...cors, 'Content-Type': 'application/json' }
      })
    }
    if (password.length > 128) {
      return new Response(JSON.stringify({ error: '비밀번호는 128자 이하여야 합니다' }), {
        status: 400, headers: { ...cors, 'Content-Type': 'application/json' }
      })
    }

    if (!validatePhone(signupPhone)) {
      return new Response(JSON.stringify({ error: '올바른 전화번호 형식이 아닙니다' }), {
        status: 400, headers: { ...cors, 'Content-Type': 'application/json' }
      })
    }

    const cleanedPhone   = signupPhone.replace(/[^0-9]/g, '')
    const formattedPhone = `${cleanedPhone.slice(0, 3)}-${cleanedPhone.slice(3, 7)}-${cleanedPhone.slice(7)}`

    // 중복 계정 체크
    const dupRes  = await fetchWithTimeout(
      `${SUPABASE_URL}/rest/v1/madi_users?username=eq.${cleanedPhone}&select=id`,
      { headers: { 'Authorization': `Bearer ${SERVICE_KEY}`, 'apikey': SERVICE_KEY } },
      SUPA_TIMEOUT_MS
    )
    // 중복 체크 조회 실패를 '중복 아님'으로 오인하면 중복 가입이 통과 → 계정 생성 전 명시 차단(M-20)
    if (!dupRes.ok) {
      console.error('parent-auth signup dupRes:', dupRes.status, await dupRes.text())
      return new Response(JSON.stringify({ error: '일시적인 오류가 발생했습니다. 잠시 후 다시 시도해주세요.' }), {
        status: 503, headers: { ...cors, 'Content-Type': 'application/json' }
      })
    }
    const dupData = await dupRes.json()
    if (Array.isArray(dupData) && dupData.length > 0) {
      return new Response(JSON.stringify({ error: '이미 가입된 전화번호입니다. 로그인 화면에서 로그인해주세요.' }), {
        status: 409, headers: { ...cors, 'Content-Type': 'application/json' }
      })
    }

    // ★ [HIGH] 신원 확인 요소 필수 — lookup 과 동일하게 이름 + 생년월일 재검증(위조 방지).
    //   lookup 을 건너뛰고 signup 을 직접 호출해도, 서버가 childId 별 이름·생년월일을 다시
    //   대조하므로 '번호만 알면 통과'가 성립하지 않는다.
    const vName  = body.verifyName  ? String(body.verifyName).trim() : ''
    const vBirth = body.verifyBirth ? String(body.verifyBirth).replace(/[^0-9]/g, '') : ''
    if (!vName || vBirth.length < 6) {
      return new Response(JSON.stringify({ error: '아동 이름과 생년월일을 입력해주세요' }), {
        status: 400, headers: { ...cors, 'Content-Type': 'application/json' }
      })
    }

    // childIds 검증 + phone-child 매핑 재확인 + center_id 수집
    const safeChildIds = childIds.slice(0, 10) // 최대 10명
    let centerId = ''
    let identityVerified = false // 연결 대상 중 (이름+생년월일) 일치 아동이 하나라도 있어야 함
    const childLinks: Array<{ child_id: string; center_id: string }> = []

    for (const cid of safeChildIds) {
      const cr = await fetchWithTimeout(
        `${SUPABASE_URL}/rest/v1/madi_children?id=eq.${encodeURIComponent(String(cid))}&select=id,center_id,data`,
        { headers: { 'Authorization': `Bearer ${SERVICE_KEY}`, 'apikey': SERVICE_KEY } },
        SUPA_TIMEOUT_MS
      )
      const cd = await cr.json()
      if (!Array.isArray(cd) || cd.length === 0) continue

      const child = cd[0]
      // 전화번호 일치 재검증 — 임의 childId 주입 방지
      const d = child.data || {}
      const phones: string[] = [d.parentPhone, d.parent_phone, d.phone].filter(Boolean)
      const phoneMatches = phones.some((p: string) => p.replace(/[^0-9]/g, '') === cleanedPhone)
      if (!phoneMatches) continue // 번호 불일치 아동은 연결하지 않음

      // 이름 + 생년월일 대조 — 이 번호의 자녀 중 최소 1명의 신원이 증명돼야 가입 통과.
      const nm = String(d.name || '').trim()
      const bd = String(d.birth || '').replace(/[^0-9]/g, '')
      if (nm !== '' && nm === vName && bd.length >= 6 && bd === vBirth) identityVerified = true

      if (!centerId) centerId = child.center_id || ''
      childLinks.push({ child_id: String(cid), center_id: child.center_id || centerId })
    }

    if (childLinks.length === 0) {
      return new Response(JSON.stringify({ error: '유효한 아동 정보가 없습니다. 다시 조회해주세요.' }), {
        status: 400, headers: { ...cors, 'Content-Type': 'application/json' }
      })
    }

    // 신원 확인 게이트 — 이름+생년월일 미일치면 계정 생성 자체를 차단(가로채기 가입 방지).
    if (!identityVerified) {
      return new Response(JSON.stringify({ error: '아동 신원 확인에 실패했습니다. 이름과 생년월일을 다시 확인해주세요.' }), {
        status: 403, headers: { ...cors, 'Content-Type': 'application/json' }
      })
    }

    // bcrypt(cost=12) 즉시 해싱 — /login 의 verifyPassword 가 bcrypt 우선 매칭.
    // 기존 SHA-256 lazy-migration 경로는 첫 로그인 시점에야 강화되는 약점이 있어 회원가입부터 강력 해시 적용.
    const hashedPassword = await bcrypt.hash(password, 12)

    // madi_users 삽입
    const userId  = crypto.randomUUID()
    const newUser = {
      id:          userId,
      username:    cleanedPhone,
      name:        cleanedPhone,
      password:    hashedPassword,
      role:        'parent',
      center_id:   centerId,
      color:       '#f59e0b',
      permissions: {},
    }

    const insertRes = await fetchWithTimeout(
      `${SUPABASE_URL}/rest/v1/madi_users`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${SERVICE_KEY}`,
          'apikey':        SERVICE_KEY,
          'Content-Type':  'application/json',
          'Prefer':        'return=minimal',
        },
        body: JSON.stringify(newUser),
      },
      SUPA_TIMEOUT_MS
    )

    if (!insertRes.ok) {
      const err = await insertRes.text()
      if (insertRes.status === 409 || err.includes('duplicate') || err.includes('unique')) {
        return new Response(JSON.stringify({ error: '이미 가입된 전화번호입니다.' }), {
          status: 409, headers: { ...cors, 'Content-Type': 'application/json' }
        })
      }
      return new Response(JSON.stringify({ error: '계정 생성에 실패했습니다. 잠시 후 다시 시도해주세요.' }), {
        status: 500, headers: { ...cors, 'Content-Type': 'application/json' }
      })
    }

    // ★ [PIPA] 가입 성공 — 동의 증빙 기록 (best-effort, 하위호환: consent 없으면 생략).
    //   고정 계약: body.consent = { agreed, sensitive, version }.
    const _consent = (body.consent && typeof body.consent === 'object') ? body.consent : null
    if (_consent) {
      logParentConsent(SUPABASE_URL, SERVICE_KEY, {
        actorId:   userId,
        centerId:  centerId,
        version:   _consent.version != null ? String(_consent.version).slice(0, 64) : 'unknown',
        sensitive: _consent.sensitive === true,
        agreed:    _consent.agreed === true,
      })
    }

    // madi_parent_children 연결
    const linkRows = childLinks.map(cl => ({
      parent_user_id: userId,
      child_id:       cl.child_id,
      center_id:      cl.center_id,
    }))

    // 연결 INSERT 실패는 더 이상 무음으로 삼키지 않는다(1-B). madi_users 는 이미 생성됐으므로
    //   계정 자체는 살리되, 자녀 연결만 실패한 경우 응답에 linkWarning 을 실어 클라이언트가
    //   "자녀 연결 실패 — 센터에 문의" 를 사용자에게 안내하게 한다(연결 없는 좀비 계정 가시화).
    //   (트랜잭션 RPC 도입은 과도 — 실패 가시화 + 로깅으로 처리.)
    let linkWarning = false
    try {
      const linkRes = await fetchWithTimeout(
        `${SUPABASE_URL}/rest/v1/madi_parent_children`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${SERVICE_KEY}`,
            'apikey':        SERVICE_KEY,
            'Content-Type':  'application/json',
            'Prefer':        'return=minimal',
          },
          body: JSON.stringify(linkRows),
        },
        SUPA_TIMEOUT_MS
      )
      if (!linkRes.ok) {
        linkWarning = true
        console.error('[parent-auth] signup link INSERT failed status=%d user=%s', linkRes.status, userId)
      }
    } catch (e) {
      linkWarning = true
      console.error('[parent-auth] signup link INSERT error user=%s:', userId, (e as Error).message)
    }

    return new Response(JSON.stringify({
      user: {
        id:        userId,
        username:  cleanedPhone,
        name:      cleanedPhone,
        role:      'parent',
        center_id: centerId,
      },
      // true 면 계정은 생성됐으나 자녀 연결에 실패 — 클라이언트가 "센터에 문의" 안내.
      linkWarning: linkWarning,
      ...(linkWarning ? { linkWarningMessage: '계정은 생성됐지만 자녀 연결에 실패했습니다. 센터에 문의해주세요.' } : {}),
    }), {
      status: 200, headers: { ...cors, 'Content-Type': 'application/json' }
    })
  }

  return new Response(JSON.stringify({ error: '알 수 없는 action' }), {
    status: 400, headers: { ...cors, 'Content-Type': 'application/json' }
  })
})
