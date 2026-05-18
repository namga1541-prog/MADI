/**
 * /ai-proxy — Anthropic API 프록시 Edge Function
 *
 * 보안:
 * - Anthropic API 키를 클라이언트에 노출하지 않음
 * - JWT 인증 필수 (모든 역할 허용, 단 유효한 토큰 보유자만)
 * - 센터별 API 키를 madi_settings 테이블에서 서버사이드 조회
 *
 * 요청 헤더: Authorization: Bearer <JWT>
 * 요청 바디: { model, max_tokens, system, messages }  (Anthropic Messages API 형식)
 * 응답: Anthropic API 원본 응답 전달
 */

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

  const centerId = user.center_id as string
  if (!centerId) {
    return new Response(JSON.stringify({ error: '센터 정보 없음' }), { status: 403, headers: CORS })
  }

  // 센터 Anthropic API 키 조회
  const settingsRes = await fetch(
    SUPA_URL + '/rest/v1/madi_settings?center_id=eq.' + centerId + '&key=eq.api_key&select=value&limit=1',
    { headers: { 'apikey': SUPA_KEY, 'Authorization': 'Bearer ' + SUPA_KEY } }
  )
  const settings = await settingsRes.json()
  const apiKey   = Array.isArray(settings) && settings[0] ? settings[0].value : null

  if (!apiKey || !apiKey.startsWith('sk-ant')) {
    return new Response(
      JSON.stringify({ error: '센터 AI API 키가 설정되지 않았습니다. 관리자에게 문의하세요.' }),
      { status: 402, headers: CORS }
    )
  }

  // 요청 바디 파싱
  let reqBody: Record<string, unknown>
  try { reqBody = await req.json() } catch {
    return new Response(JSON.stringify({ error: '잘못된 요청 형식' }), { status: 400, headers: CORS })
  }

  // Anthropic API 호출 (서버사이드)
  const anthropicRes = await fetch('https://api.anthropic.com/v1/messages', {
    method:  'POST',
    headers: {
      'Content-Type':      'application/json',
      'x-api-key':         apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify(reqBody),
  })

  const ct   = anthropicRes.headers.get('content-type') || ''
  const data = ct.includes('json') ? await anthropicRes.json() : await anthropicRes.text()

  return new Response(
    JSON.stringify(data),
    { status: anthropicRes.status, headers: { ...CORS, 'Content-Type': 'application/json' } }
  )
})
