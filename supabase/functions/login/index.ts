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
import { makeCORS as makeBaseCORS, signJwt, checkRateLimit } from '../_shared/auth.ts'

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

  let body: { username?: string; password?: string }
  try { body = await req.json() } catch {
    return new Response(JSON.stringify({ error: '잘못된 요청 형식' }), { status: 400, headers: CORS })
  }

  const username = (body.username || '').trim()
  const password = body.password || ''
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

  // DB에서 사용자 조회
  const userRes = await fetch(
    SUPA_URL + '/rest/v1/madi_users?username=eq.' + encodeURIComponent(username) + '&select=id,username,name,password,role,center_id,color,permissions',
    { headers: { 'apikey': SUPA_KEY, 'Authorization': 'Bearer ' + SUPA_KEY } }
  )
  if (!userRes.ok) {
    return new Response(JSON.stringify({ error: '서버 오류가 발생했습니다.' }), { status: 500, headers: CORS })
  }
  const users = await userRes.json()
  const user  = Array.isArray(users) ? users[0] : null

  if (!user) {
    await bcrypt.hash('dummy', 10)
    return new Response(JSON.stringify({ error: '아이디 또는 비밀번호가 올바르지 않습니다.' }), { status: 401, headers: CORS })
  }

  if (user.status && user.status === 'inactive') {
    return new Response(JSON.stringify({ error: '비활성화된 계정입니다. 관리자에게 문의하세요.' }), { status: 403, headers: CORS })
  }

  const { ok, needRehash } = await verifyPassword(password, user.password)
  if (!ok) {
    return new Response(JSON.stringify({ error: '아이디 또는 비밀번호가 올바르지 않습니다.' }), { status: 401, headers: CORS })
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
