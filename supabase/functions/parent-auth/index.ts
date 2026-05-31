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
import { getClientIp } from '../_shared/auth.ts'

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
    const r = await fetch(`${supabaseUrl}/rest/v1/rpc/madi_rate_limit_hit`, {
      method:  'POST',
      headers: {
        'Authorization': `Bearer ${serviceKey}`,
        'apikey':        serviceKey,
        'Content-Type':  'application/json',
      },
      body: JSON.stringify({ p_key: key, p_min_window_ms: minMs, p_hour_window_ms: hourMs }),
    })
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

// ── SHA-256 해싱 (클라이언트 hashPassword()와 동일 방식, /login 호환) ─────
async function sha256Hex(password: string): Promise<string> {
  const data       = new TextEncoder().encode(password)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('')
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

  // IP 추출은 _shared 의 getClientIp 로 단일화 (cf-connecting-ip 우선) — login 과 동일 로직.
  const ip = getClientIp(req)

  let body: { action?: string; phone?: string; password?: string; childIds?: string[] }
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

    const cleaned   = phone.replace(/[^0-9]/g, '')
    const formatted = `${cleaned.slice(0, 3)}-${cleaned.slice(3, 7)}-${cleaned.slice(7)}`

    // 이미 가입된 계정인지 확인
    const existRes  = await fetch(
      `${SUPABASE_URL}/rest/v1/madi_users?username=eq.${cleaned}&role=eq.parent&select=id`,
      { headers: { 'Authorization': `Bearer ${SERVICE_KEY}`, 'apikey': SERVICE_KEY } }
    )
    const existData = await existRes.json()
    if (Array.isArray(existData) && existData.length > 0) {
      // alreadyJoined: true — 클라이언트가 로그인 화면으로 안내
      return new Response(JSON.stringify({ children: [], alreadyJoined: true }), {
        status: 200, headers: { ...cors, 'Content-Type': 'application/json' }
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

    const childRes = await fetch(
      `${SUPABASE_URL}/rest/v1/madi_children?or=(${orFilter})&select=id,data`,
      { headers: { 'Authorization': `Bearer ${SERVICE_KEY}`, 'apikey': SERVICE_KEY } }
    )
    const children = await childRes.json()

    // 최소 정보만 반환 — center_id 미노출
    const matched = (Array.isArray(children) ? children : []).map((c: any) => ({
      childId: c.id,
      name:    (c.data || {}).name || '이름 없음',
    }))

    // User Enumeration 방지: 없는 경우도 동일한 응답 구조
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

    // 비밀번호 최소 4자, 최대 128자 (테스트 기간 — 정식 배포 시 8자로 변경)
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
    const dupRes  = await fetch(
      `${SUPABASE_URL}/rest/v1/madi_users?username=eq.${cleanedPhone}&select=id`,
      { headers: { 'Authorization': `Bearer ${SERVICE_KEY}`, 'apikey': SERVICE_KEY } }
    )
    const dupData = await dupRes.json()
    if (Array.isArray(dupData) && dupData.length > 0) {
      return new Response(JSON.stringify({ error: '이미 가입된 전화번호입니다. 로그인 화면에서 로그인해주세요.' }), {
        status: 409, headers: { ...cors, 'Content-Type': 'application/json' }
      })
    }

    // childIds 검증 + phone-child 매핑 재확인 + center_id 수집
    const safeChildIds = childIds.slice(0, 10) // 최대 10명
    let centerId = ''
    const childLinks: Array<{ child_id: string; center_id: string }> = []

    for (const cid of safeChildIds) {
      const cr = await fetch(
        `${SUPABASE_URL}/rest/v1/madi_children?id=eq.${encodeURIComponent(String(cid))}&select=id,center_id,data`,
        { headers: { 'Authorization': `Bearer ${SERVICE_KEY}`, 'apikey': SERVICE_KEY } }
      )
      const cd = await cr.json()
      if (!Array.isArray(cd) || cd.length === 0) continue

      const child = cd[0]
      // 전화번호 일치 재검증 — 임의 childId 주입 방지
      const d = child.data || {}
      const phones: string[] = [d.parentPhone, d.parent_phone, d.phone].filter(Boolean)
      const phoneMatches = phones.some((p: string) => p.replace(/[^0-9]/g, '') === cleanedPhone)
      if (!phoneMatches) continue // 번호 불일치 아동은 연결하지 않음

      if (!centerId) centerId = child.center_id || ''
      childLinks.push({ child_id: String(cid), center_id: child.center_id || centerId })
    }

    if (childLinks.length === 0) {
      return new Response(JSON.stringify({ error: '유효한 아동 정보가 없습니다. 다시 조회해주세요.' }), {
        status: 400, headers: { ...cors, 'Content-Type': 'application/json' }
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

    const insertRes = await fetch(
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
      }
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

    // madi_parent_children 연결
    const linkRows = childLinks.map(cl => ({
      parent_user_id: userId,
      child_id:       cl.child_id,
      center_id:      cl.center_id,
    }))

    await fetch(
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
      }
    ).catch(() => {}) // 연결 실패해도 계정은 생성됨 — 선생님이 수동 연결 가능

    return new Response(JSON.stringify({
      user: {
        id:        userId,
        username:  cleanedPhone,
        name:      cleanedPhone,
        role:      'parent',
        center_id: centerId,
      }
    }), {
      status: 200, headers: { ...cors, 'Content-Type': 'application/json' }
    })
  }

  return new Response(JSON.stringify({ error: '알 수 없는 action' }), {
    status: 400, headers: { ...cors, 'Content-Type': 'application/json' }
  })
})
