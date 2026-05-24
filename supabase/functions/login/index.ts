/**
 * /login — 로그인 Edge Function
 *
 * 보안 개선 사항:
 * 1. 서버사이드 Rate Limit: IP + username 기반, 10회/15분 초과 시 차단
 * 2. bcrypt 비밀번호 검증 (기존 SHA-256 해시와 하위 호환 — lazy migration)
 *    - 기존 SHA-256 해시 일치 시 자동으로 bcrypt 로 재해싱 후 DB 업데이트
 *
 * 요청: POST { username: string, password: string }
 * 응답: { token: string, user: object } | { error: string }
 */

import bcrypt from "npm:bcryptjs@2.4.3"
import { makeCORS as makeBaseCORS, signJwt, checkRateLimit, verifyTotp } from '../_shared/auth.ts'

function makeCORS(origin: string | null): Record<string, string> {
  return makeBaseCORS(origin, { headers: 'content-type' })
}


// ── 비밀번호 유틸 ──────────────────────────────────────────────────────────
async function sha256Hex(s: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s))
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('')
}

/**
 * plain : 클라이언트가 보낸 평문 비밀번호
 * stored: DB 저장 해시 (SHA-256 hex 64자 OR bcrypt $2b$...)
 * @returns { ok: boolean, needRehash: boolean }
 */
async function verifyPassword(plain: string, stored: string): Promise<{ ok: boolean; needRehash: boolean }> {
  if (stored.startsWith('$2')) {
    // bcrypt(plain) — 레거시 lazy-migration 경로
    if (await bcrypt.compare(plain, stored)) return { ok: true, needRehash: false }
    // bcrypt(sha256(plain)) — 회원가입 시 클라이언트가 SHA-256 해시를 전송한 경우
    // needRehash=true 로 bcrypt(plain) 으로 재해싱하여 이후 로그인 정상화
    const sha = await sha256Hex(plain)
    if (await bcrypt.compare(sha, stored)) return { ok: true, needRehash: true }
    return { ok: false, needRehash: false }
  }
  // 레거시 SHA-256 헥스 (64자) — bcrypt 미적용 구버전 계정
  const sha = await sha256Hex(plain)
  if (sha === stored) return { ok: true, needRehash: true }
  return { ok: false, needRehash: false }
}

// JWT 서명 / Rate Limit 은 _shared/auth.ts 에서 import

// ── 메인 핸들러 ───────────────────────────────────────────────────────────
Deno.serve(async (req: Request) => {
  const CORS = makeCORS(req.headers.get('origin'))
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })

  const JWT_SECRET = Deno.env.get('MADI_JWT_SECRET')
  const SUPA_URL   = Deno.env.get('SUPABASE_URL')
  const SUPA_KEY   = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

  if (!JWT_SECRET || !SUPA_URL || !SUPA_KEY) {
    return new Response(JSON.stringify({ error: '서버 설정 오류' }), { status: 500, headers: CORS })
  }

  let body: { username?: string; password?: string; totp_code?: string }
  try { body = await req.json() } catch {
    return new Response(JSON.stringify({ error: '잘못된 요청 형식' }), { status: 400, headers: CORS })
  }

  const username  = (body.username || '').trim()
  const password  = body.password || ''
  const totpCode  = (body.totp_code || '').trim()
  if (!username || !password) {
    return new Response(JSON.stringify({ error: '아이디와 비밀번호를 입력해주세요' }), { status: 400, headers: CORS })
  }

  // ── 레이트 리밋: IP+username 키, 분당 10회/시간당 50회 ──
  // x-forwarded-for 의 가장 오른쪽 IP (proxy chain 상 신뢰 가능한 client IP)
  const xff   = req.headers.get('x-forwarded-for') ?? ''
  const xffIp = xff ? xff.split(',').pop()!.trim() : ''
  const ip    = xffIp || req.headers.get('cf-connecting-ip') || 'unknown'
  const rlKey = `login:${ip}:${username.toLowerCase()}`
  const rl    = await checkRateLimit(rlKey, SUPA_URL, SUPA_KEY, 10, 50)
  if (!rl.allowed) {
    return new Response(
      JSON.stringify({ error: `로그인 시도가 너무 많습니다. ${rl.retryAfter}초 후 다시 시도해주세요.` }),
      { status: 429, headers: { ...CORS, 'Content-Type': 'application/json', 'Retry-After': String(rl.retryAfter ?? 60) } }
    )
  }

  // DB에서 사용자 조회 (SEC4: 잠금 + SEC6: 2FA 컬럼도 같이)
  // ⚠️ Defensive: 마이그레이션 전 환경에서도 동작하도록 단계적 select fallback.
  //    1차: 신규 컬럼 포함 / 2차: base 컬럼만 (SEC3/4/6 기능 비활성, 로그인 자체는 살림)
  // BASE_COLS: 원래부터 존재하는 컬럼만 (status 도 일부 DB 에는 없을 수 있음)
  // EXT_COLS:  status + SEC3/4/6 신규 컬럼 (마이그레이션 후만)
  const BASE_COLS = 'id,username,name,password,role,center_id,color,permissions'
  const EXT_COLS  = BASE_COLS + ',status,failed_login_count,last_failed_at,locked_until,totp_secret,totp_enabled'
  const userUrl = (cols: string) =>
    SUPA_URL + '/rest/v1/madi_users?username=eq.' + encodeURIComponent(username) + '&select=' + cols

  let userRes = await fetch(userUrl(EXT_COLS), {
    headers: { 'apikey': SUPA_KEY, 'Authorization': 'Bearer ' + SUPA_KEY }
  })
  if (!userRes.ok) {
    // 컬럼 미존재 가능성 — base 컬럼만으로 재시도
    userRes = await fetch(userUrl(BASE_COLS), {
      headers: { 'apikey': SUPA_KEY, 'Authorization': 'Bearer ' + SUPA_KEY }
    })
    if (!userRes.ok) {
      return new Response(JSON.stringify({ error: '서버 오류가 발생했습니다.' }), { status: 500, headers: CORS })
    }
  }
  const users = await userRes.json()
  const user  = Array.isArray(users) ? users[0] : null

  if (!user) {
    // 타이밍 공격 방어 — 사용자 없어도 bcrypt 한 번 돌려 응답시간 정상화
    await bcrypt.hash('dummy', 10)
    return new Response(JSON.stringify({ error: '아이디 또는 비밀번호가 올바르지 않습니다.' }), { status: 401, headers: CORS })
  }

  if (user.status && user.status === 'inactive') {
    return new Response(JSON.stringify({ error: '비활성화된 계정입니다. 관리자에게 문의하세요.' }), { status: 403, headers: CORS })
  }

  // ── SEC4: 계정 잠금 체크 ──
  // 5회 연속 실패 시 30분 잠금. 잠금 시간이 지나면 자동 해제 (다음 실패가 카운터를 0부터 다시).
  const LOCK_THRESHOLD     = 5
  const LOCK_DURATION_MS   = 30 * 60 * 1000      // 30분
  const COUNT_WINDOW_MS    = 30 * 60 * 1000      // 30분 윈도우 — 그 안의 실패만 누적
  const now                = Date.now()

  if (user.locked_until && new Date(user.locked_until).getTime() > now) {
    const remainSec = Math.ceil((new Date(user.locked_until).getTime() - now) / 1000)
    const remainMin = Math.ceil(remainSec / 60)
    return new Response(
      JSON.stringify({ error: `계정이 일시 잠금되었습니다. ${remainMin}분 후 다시 시도해주세요.` }),
      { status: 423, headers: { ...CORS, 'Content-Type': 'application/json', 'Retry-After': String(remainSec) } }
    )
  }

  const { ok, needRehash } = await verifyPassword(password, user.password)
  if (!ok) {
    // ── SEC4: 실패 카운터 증가 + 임계 도달 시 잠금 설정 ──
    const within = user.last_failed_at && (now - new Date(user.last_failed_at).getTime()) < COUNT_WINDOW_MS
    const newCount = within ? Number(user.failed_login_count || 0) + 1 : 1
    const willLock = newCount >= LOCK_THRESHOLD
    const update: Record<string, unknown> = {
      failed_login_count: newCount,
      last_failed_at:     new Date(now).toISOString(),
    }
    if (willLock) update.locked_until = new Date(now + LOCK_DURATION_MS).toISOString()
    fetch(SUPA_URL + '/rest/v1/madi_users?id=eq.' + user.id, {
      method:  'PATCH',
      headers: { 'Content-Type': 'application/json', 'apikey': SUPA_KEY, 'Authorization': 'Bearer ' + SUPA_KEY },
      body:    JSON.stringify(update),
    }).catch(() => { /* fire-and-forget */ })

    const msg = willLock
      ? `로그인 5회 실패 — 계정이 30분간 잠금되었습니다.`
      : `아이디 또는 비밀번호가 올바르지 않습니다. (남은 시도 ${LOCK_THRESHOLD - newCount}회)`
    return new Response(
      JSON.stringify({ error: msg }),
      { status: willLock ? 423 : 401, headers: CORS }
    )
  }

  // ── SEC6: 2FA 검증 — 비번 통과 후, totp_enabled 면 6자리 코드 요구 ──
  if (user.totp_enabled && user.totp_secret) {
    if (!totpCode) {
      return new Response(
        JSON.stringify({ require_totp: true, error: '6자리 인증 코드를 입력해주세요' }),
        { status: 401, headers: CORS }
      )
    }
    if (!/^\d{6}$/.test(totpCode)) {
      return new Response(JSON.stringify({ require_totp: true, error: '6자리 숫자 코드 형식 오류' }), { status: 401, headers: CORS })
    }
    const totpOk = await verifyTotp(String(user.totp_secret), totpCode, 1)
    if (!totpOk) {
      // 잘못된 TOTP 도 실패 카운터에 합산 (brute-force 방어)
      const within = user.last_failed_at && (now - new Date(user.last_failed_at).getTime()) < COUNT_WINDOW_MS
      const newCount = within ? Number(user.failed_login_count || 0) + 1 : 1
      const willLock = newCount >= LOCK_THRESHOLD
      const update: Record<string, unknown> = {
        failed_login_count: newCount,
        last_failed_at:     new Date(now).toISOString(),
      }
      if (willLock) update.locked_until = new Date(now + LOCK_DURATION_MS).toISOString()
      fetch(SUPA_URL + '/rest/v1/madi_users?id=eq.' + user.id, {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json', 'apikey': SUPA_KEY, 'Authorization': 'Bearer ' + SUPA_KEY },
        body:    JSON.stringify(update),
      }).catch(() => {})
      return new Response(
        JSON.stringify({ require_totp: true, error: '인증 코드가 올바르지 않습니다' }),
        { status: 401, headers: CORS }
      )
    }
  }

  // ── SEC4: 성공 시 카운터·잠금 리셋 ──
  if (user.failed_login_count || user.locked_until) {
    fetch(SUPA_URL + '/rest/v1/madi_users?id=eq.' + user.id, {
      method:  'PATCH',
      headers: { 'Content-Type': 'application/json', 'apikey': SUPA_KEY, 'Authorization': 'Bearer ' + SUPA_KEY },
      body:    JSON.stringify({ failed_login_count: 0, locked_until: null, last_failed_at: null }),
    }).catch(() => { /* fire-and-forget */ })
  }

  // Lazy bcrypt 마이그레이션: SHA-256 해시 → bcrypt 로 재해싱
  if (needRehash) {
    const newHash = await bcrypt.hash(password, 12)
    fetch(SUPA_URL + '/rest/v1/madi_users?id=eq.' + user.id, {
      method:  'PATCH',
      headers: { 'Content-Type': 'application/json', 'apikey': SUPA_KEY, 'Authorization': 'Bearer ' + SUPA_KEY },
      body:    JSON.stringify({ password: newHash }),
    }).catch(() => { /* fire-and-forget, 실패해도 로그인 막지 않음 */ })
  }

  // JWT 발급 (24시간)
  const iat = Math.floor(Date.now() / 1000)
  const exp = iat + 24 * 3600
  const payload: Record<string, unknown> = {
    sub:       user.id,
    username:  user.username,
    name:      user.name,
    role:      user.role,
    center_id: user.center_id,
    iat,
    exp,
  }

  // 학부모 역할: 연결된 child_id 주입
  if (user.role === 'parent') {
    const pcRes = await fetch(
      SUPA_URL + '/rest/v1/madi_parent_children?parent_user_id=eq.' + user.id + '&select=child_id&limit=1',
      { headers: { 'apikey': SUPA_KEY, 'Authorization': 'Bearer ' + SUPA_KEY } }
    )
    const pc = await pcRes.json()
    if (Array.isArray(pc) && pc[0]) payload.parent_child_id = pc[0].child_id
  }

  const token = await signJwt(payload, JWT_SECRET)

  // 응답에는 password 필드 제외
  const { password: _pw, ...safeUser } = user

  // httpOnly 쿠키로 JWT 발급 — JS에서 접근 불가 (XSS 탈취 차단)
  // SameSite=None;Secure: 크로스 오리진(GitHub Pages → Supabase) 쿠키 전송 허용
  const cookieHeader = `madi_session=${token}; HttpOnly; Secure; SameSite=None; Path=/; Max-Age=86400`

  // token 필드: 구 클라이언트 하위 호환 유지 (신 클라이언트 배포 후 제거 예정)
  return new Response(
    JSON.stringify({ token, user: safeUser }),
    { status: 200, headers: { ...CORS, 'Content-Type': 'application/json', 'Set-Cookie': cookieHeader } }
  )
})
