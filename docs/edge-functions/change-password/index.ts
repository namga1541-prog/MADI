/**
 * /change-password — 비밀번호 변경 Edge Function
 *
 * 보안 개선:
 * - 새 비밀번호를 bcrypt(cost=12)로 해싱하여 저장
 * - 현재 비밀번호 검증도 bcrypt/SHA-256 하이브리드 지원
 *
 * 요청 헤더: Authorization: Bearer <JWT>
 * 요청 바디: { currentPassword: string, newPassword: string }
 * 응답: {} | { error: string }
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
    'Access-Control-Allow-Headers': 'authorization, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Vary': 'Origin',
  }
}

// ── JWT 검증 ──────────────────────────────────────────────────────────────
async function verifyJwt(token: string, secret: string) {
  const [header, body, sig] = token.split('.')
  if (!header || !body || !sig) throw new Error('JWT 형식 오류')
  const key = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['verify']
  )
  const b64 = sig.replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(b64)
  const sigBytes = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; i++) sigBytes[i] = raw.charCodeAt(i)
  const valid = await crypto.subtle.verify('HMAC', key, sigBytes, new TextEncoder().encode(`${header}.${body}`))
  if (!valid) throw new Error('JWT 서명 불일치')
  const payload = JSON.parse(atob(body.replace(/-/g, '+').replace(/_/g, '/')))
  if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) throw new Error('JWT 만료')
  return payload
}

// ── 비밀번호 유틸 ──────────────────────────────────────────────────────────
async function sha256Hex(s: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s))
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('')
}

async function verifyPassword(plain: string, stored: string): Promise<boolean> {
  if (stored.startsWith('$2')) return await bcrypt.compare(plain, stored)
  return (await sha256Hex(plain)) === stored
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

  const auth  = req.headers.get('Authorization') || ''
  const token = auth.replace('Bearer ', '')
  let user: Record<string, unknown>
  try { user = await verifyJwt(token, JWT_SECRET) } catch {
    return new Response(JSON.stringify({ error: '인증이 필요합니다' }), { status: 401, headers: CORS })
  }

  let body: { currentPassword?: string; newPassword?: string }
  try { body = await req.json() } catch {
    return new Response(JSON.stringify({ error: '잘못된 요청 형식' }), { status: 400, headers: CORS })
  }

  const currentPw = body.currentPassword || ''
  const newPw     = body.newPassword     || ''
  if (!currentPw || !newPw) {
    return new Response(JSON.stringify({ error: '현재 비밀번호와 새 비밀번호를 모두 입력해주세요' }), { status: 400, headers: CORS })
  }
  if (currentPw === newPw) {
    return new Response(JSON.stringify({ error: '현재 비밀번호와 동일합니다' }), { status: 400, headers: CORS })
  }

  // DB에서 현재 해시 조회
  const dbRes = await fetch(
    SUPA_URL + '/rest/v1/madi_users?id=eq.' + user.sub + '&select=password',
    { headers: { 'apikey': SUPA_KEY, 'Authorization': 'Bearer ' + SUPA_KEY } }
  )
  const rows = await dbRes.json()
  const row  = Array.isArray(rows) ? rows[0] : null
  if (!row) {
    return new Response(JSON.stringify({ error: '사용자를 찾을 수 없습니다' }), { status: 404, headers: CORS })
  }

  const ok = await verifyPassword(currentPw, row.password)
  if (!ok) {
    return new Response(JSON.stringify({ error: '현재 비밀번호가 올바르지 않습니다' }), { status: 401, headers: CORS })
  }

  // 새 비밀번호 bcrypt 해싱 (cost 12)
  const newHash = await bcrypt.hash(newPw, 12)

  const patchRes = await fetch(
    SUPA_URL + '/rest/v1/madi_users?id=eq.' + user.sub,
    {
      method:  'PATCH',
      headers: { 'Content-Type': 'application/json', 'apikey': SUPA_KEY, 'Authorization': 'Bearer ' + SUPA_KEY },
      body:    JSON.stringify({ password: newHash }),
    }
  )
  if (!patchRes.ok) {
    return new Response(JSON.stringify({ error: '비밀번호 변경 실패 — 잠시 후 다시 시도해주세요' }), { status: 500, headers: CORS })
  }

  return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { ...CORS, 'Content-Type': 'application/json' } })
})
