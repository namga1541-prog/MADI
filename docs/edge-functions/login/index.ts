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

// ── CORS ──────────────────────────────────────────────────────────────────
const ALLOWED_ORIGINS = new Set([
  'https://namga1541-prog.github.io',
  'http://localhost:3000',
  'http://127.0.0.1:3000',
  'null',
])

function makeCORS(origin: string | null): Record<string, string> {
  const o = origin ?? 'null'
  const acao = ALLOWED_ORIGINS.has(o) ? o : 'https://namga1541-prog.github.io'
  return {
    'Access-Control-Allow-Origin':  acao,
    'Access-Control-Allow-Headers': 'content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Vary': 'Origin',
  }
}

// ── 서버사이드 Rate Limit ─────────────────────────────────────────────────
// Edge Function 인스턴스 내 메모리에 저장 (재시작 시 초기화 — 충분한 억제력)
interface RLEntry { count: number; resetAt: number }
const rlMap = new Map<string, RLEntry>()
const RL_MAX     = 10          // 최대 시도 횟수
const RL_WINDOW  = 15 * 60_000 // 15분 (ms)

function checkRL(key: string): boolean {
  const now = Date.now()
  const e   = rlMap.get(key)
  if (!e || e.resetAt < now) { rlMap.set(key, { count: 1, resetAt: now + RL_WINDOW }); return true }
  if (e.count >= RL_MAX) return false
  e.count++; return true
}

function resetRL(key: string) { rlMap.delete(key) }

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
    // bcrypt 해시
    const ok = await bcrypt.compare(plain, stored)
    return { ok, needRehash: false }
  }
  // 레거시 SHA-256 헥스 (64자)
  const sha = await sha256Hex(plain)
  if (sha === stored) return { ok: true, needRehash: true }
  return { ok: false, needRehash: false }
}

// ── JWT 서명 ──────────────────────────────────────────────────────────────
function b64url(buf: ArrayBuffer): string {
  return btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
}

async function signJwt(payload: Record<string, unknown>, secret: string): Promise<string> {
  const header  = b64url(new TextEncoder().encode(JSON.stringify({ alg: 'HS256', typ: 'JWT' })))
  const body    = b64url(new TextEncoder().encode(JSON.stringify(payload)))
  const key     = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  const sigBuf  = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`${header}.${body}`))
  return `${header}.${body}.${b64url(sigBuf)}`
}

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

  // IP 추출 (Cloudflare → Supabase 헤더 순)
  const ip = req.headers.get('cf-connecting-ip')
           || req.headers.get('x-forwarded-for')?.split(',')[0].trim()
           || 'unknown'

  let body: { username?: string; password?: string }
  try { body = await req.json() } catch {
    return new Response(JSON.stringify({ error: '잘못된 요청 형식' }), { status: 400, headers: CORS })
  }

  const username = (body.username || '').trim()
  const password = body.password || ''
  if (!username || !password) {
    return new Response(JSON.stringify({ error: '아이디와 비밀번호를 입력해주세요' }), { status: 400, headers: CORS })
  }

  // Rate limit: IP 기반 + username 기반
  const rlKeyIp   = 'ip:' + ip
  const rlKeyUser = 'u:' + username.toLowerCase()
  if (!checkRL(rlKeyIp) || !checkRL(rlKeyUser)) {
    return new Response(JSON.stringify({ error: '로그인 시도가 너무 많습니다. 15분 후 다시 시도해주세요.' }), { status: 429, headers: CORS })
  }

  // DB에서 사용자 조회
  const userRes = await fetch(
    SUPA_URL + '/rest/v1/madi_users?username=eq.' + encodeURIComponent(username) + '&select=id,username,name,password,role,center_id,color,permissions,status',
    { headers: { 'apikey': SUPA_KEY, 'Authorization': 'Bearer ' + SUPA_KEY } }
  )
  const users = await userRes.json()
  const user  = Array.isArray(users) ? users[0] : null

  if (!user) {
    // 타이밍 공격 방지: 존재하지 않는 계정도 동일 시간 소요
    await bcrypt.hash('dummy', 10)
    return new Response(JSON.stringify({ error: '아이디 또는 비밀번호가 올바르지 않습니다.' }), { status: 401, headers: CORS })
  }

  if (user.status === 'inactive') {
    return new Response(JSON.stringify({ error: '비활성화된 계정입니다. 관리자에게 문의하세요.' }), { status: 403, headers: CORS })
  }

  const { ok, needRehash } = await verifyPassword(password, user.password)
  if (!ok) {
    return new Response(JSON.stringify({ error: '아이디 또는 비밀번호가 올바르지 않습니다.' }), { status: 401, headers: CORS })
  }

  // Rate limit 리셋 (로그인 성공)
  resetRL(rlKeyIp)
  resetRL(rlKeyUser)

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
  const exp = Math.floor(Date.now() / 1000) + 24 * 3600
  const payload: Record<string, unknown> = {
    sub:       user.id,
    username:  user.username,
    name:      user.name,
    role:      user.role,
    center_id: user.center_id,
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
  return new Response(
    JSON.stringify({ token, user: safeUser }),
    { status: 200, headers: { ...CORS, 'Content-Type': 'application/json' } }
  )
})
