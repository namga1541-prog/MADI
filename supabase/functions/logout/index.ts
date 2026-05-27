/**
 * /logout — 세션 쿠키 삭제
 *
 * 요청: POST (인증 불필요)
 * 응답: { ok: true }
 * 효과: madi_session httpOnly 쿠키를 Max-Age=0 으로 만료
 */

const ALLOWED_ORIGINS = new Set([
  'https://namga1541-prog.github.io',
  'http://localhost:3000',
  'http://127.0.0.1:3000',
  'null',
])

function makeCORS(origin: string | null): Record<string, string> {
  const o    = origin ?? 'null'
  const acao = ALLOWED_ORIGINS.has(o) ? o : 'https://namga1541-prog.github.io'
  return {
    'Access-Control-Allow-Origin':      acao,
    'Access-Control-Allow-Headers':     'content-type',
    'Access-Control-Allow-Methods':     'POST, OPTIONS',
    'Access-Control-Allow-Credentials': 'true',
    'Vary': 'Origin',
  }
}

Deno.serve(async (req: Request) => {
  const CORS = makeCORS(req.headers.get('origin'))
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })

  // 쿠키 만료 (Max-Age=0)
  const clearCookie = 'madi_session=; HttpOnly; Secure; SameSite=None; Path=/; Max-Age=0'

  return new Response(
    JSON.stringify({ ok: true }),
    { status: 200, headers: { ...CORS, 'Content-Type': 'application/json', 'Set-Cookie': clearCookie } }
  )
})
