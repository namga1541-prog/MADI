/**
 * /_shared/auth — Edge Function 공통 인증·CORS 유틸
 *
 * 5개 함수(api, login, change-password, ai-proxy, upload-image, notify-test, parent-auth)에
 * 동일하게 들어 있던 makeCORS / getCookieToken / verifyJwt / signJwt 를 단일 모듈로 추출.
 *
 * 각 함수는 다음과 같이 import:
 *   import { makeCORS, verifyJwt, getCookieToken } from '../_shared/auth.ts'
 *
 * Supabase CLI 의 deploy 는 import 트리를 자동 번들링하므로 별도 설정 불필요.
 */

// ── CORS ─────────────────────────────────────────────────────────────────
// 'null' Origin 허용 여부는 함수별로 다르므로 옵션으로 분리.
// - login / api / change-password / ai-proxy: file:// 로컬 실행 지원 위해 allowNullOrigin=true
// - upload-image / parent-auth: sandboxed iframe CSRF 차단 위해 allowNullOrigin=false
export function makeCORS(
  origin: string | null,
  opts: { allowNullOrigin?: boolean; methods?: string; headers?: string } = {}
): Record<string, string> {
  const allowNull = opts.allowNullOrigin !== false
  const allowed   = new Set<string>([
    'https://namga1541-prog.github.io',
    'http://localhost:3000',
    'http://127.0.0.1:3000',
  ])
  if (allowNull) allowed.add('null')

  const o    = origin ?? (allowNull ? 'null' : '')
  const acao = allowed.has(o) ? o : 'https://namga1541-prog.github.io'

  return {
    'Access-Control-Allow-Origin':      acao,
    'Access-Control-Allow-Headers':     opts.headers ?? 'authorization, content-type',
    'Access-Control-Allow-Methods':     opts.methods ?? 'POST, OPTIONS',
    'Access-Control-Allow-Credentials': 'true',
    'Vary': 'Origin',
  }
}

// ── 토큰 추출 ─────────────────────────────────────────────────────────────
// httpOnly 쿠키 우선, Authorization: Bearer 헤더 fallback
export function getCookieToken(req: Request): string {
  const cookie = req.headers.get('cookie') || ''
  const match  = cookie.match(/(?:^|;\s*)madi_session=([^;]+)/)
  return match ? match[1] : ''
}

export function getAuthToken(req: Request): string {
  const cookieTok = getCookieToken(req)
  if (cookieTok) return cookieTok
  const auth = req.headers.get('Authorization') || req.headers.get('authorization') || ''
  return auth.replace(/^Bearer\s+/i, '').trim()
}

// ── JWT 검증 (HS256, exp 강제) ─────────────────────────────────────────────
// - alg:none / 비대칭→대칭 confusion 공격 차단
// - exp 클레임 없으면 거부 (무기한 토큰 방지)
export async function verifyJwt(token: string, secret: string): Promise<Record<string, unknown>> {
  const [header, body, sig] = token.split('.')
  if (!header || !body || !sig) throw new Error('JWT 형식 오류')

  let headerObj: { alg?: string }
  try {
    headerObj = JSON.parse(atob(header.replace(/-/g, '+').replace(/_/g, '/')))
  } catch (_) {
    throw new Error('JWT 헤더 파싱 실패')
  }
  if (headerObj.alg !== 'HS256') throw new Error('지원하지 않는 JWT 알고리즘')

  const key = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['verify']
  )
  const b64      = sig.replace(/-/g, '+').replace(/_/g, '/')
  const raw      = atob(b64)
  const sigBytes = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; i++) sigBytes[i] = raw.charCodeAt(i)

  const valid = await crypto.subtle.verify(
    'HMAC', key, sigBytes,
    new TextEncoder().encode(`${header}.${body}`)
  )
  if (!valid) throw new Error('JWT 서명 불일치')

  const payload = JSON.parse(atob(body.replace(/-/g, '+').replace(/_/g, '/')))
  if (!payload.exp) throw new Error('JWT 만료 정보 없음 (exp 필수)')
  if (payload.exp < Math.floor(Date.now() / 1000)) throw new Error('JWT 만료')

  return payload
}

// ── JWT 서명 (login 함수 전용) ────────────────────────────────────────────
function b64url(buf: ArrayBuffer | Uint8Array): string {
  const view = buf instanceof Uint8Array ? buf : new Uint8Array(buf)
  return btoa(String.fromCharCode(...view))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
}

export async function signJwt(payload: Record<string, unknown>, secret: string): Promise<string> {
  const header  = b64url(new TextEncoder().encode(JSON.stringify({ alg: 'HS256', typ: 'JWT' })))
  const body    = b64url(new TextEncoder().encode(JSON.stringify(payload)))
  const key     = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  )
  const sigBuf  = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`${header}.${body}`))
  return `${header}.${body}.${b64url(sigBuf)}`
}

// ── Rate Limit (madi_rate_limit_hit RPC) ─────────────────────────────────
// 분/시간 윈도우 카운터를 DB 상에서 단일 트랜잭션으로 증가시키고 결과 반환.
// 실패 시 fail-open (다른 보안 계층에 의존).
export async function checkRateLimit(
  key: string,
  supaUrl: string,
  supaKey: string,
  perMin: number,
  perHour: number
): Promise<{ allowed: boolean; retryAfter?: number }> {
  try {
    const r = await fetch(`${supaUrl}/rest/v1/rpc/madi_rate_limit_hit`, {
      method:  'POST',
      headers: {
        'Authorization': `Bearer ${supaKey}`,
        'apikey':        supaKey,
        'Content-Type':  'application/json',
      },
      body: JSON.stringify({ p_key: key, p_min_window_ms: 60_000, p_hour_window_ms: 3_600_000 }),
    })
    if (!r.ok) return { allowed: true }
    const d = await r.json() as { count: number; hour_count: number; window_start: string; hour_start: string }
    if (d.count > perMin) {
      const wait = Math.max(1, Math.ceil((new Date(d.window_start).getTime() + 60_000 - Date.now()) / 1000))
      return { allowed: false, retryAfter: wait }
    }
    if (d.hour_count > perHour) {
      const wait = Math.max(1, Math.ceil((new Date(d.hour_start).getTime() + 3_600_000 - Date.now()) / 1000))
      return { allowed: false, retryAfter: wait }
    }
    return { allowed: true }
  } catch (_) {
    return { allowed: true }
  }
}
