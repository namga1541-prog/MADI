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

// ── TOTP (RFC 6238) — 2FA 유틸 (SEC6, 2026-05-24) ────────────────────────
// secret 은 base32 인코딩된 공유 키, code 는 사용자 입력 6자리 문자열.
// window=1 → 이전/현재/다음 30초 step 까지 허용 (clock skew 허용).
const _TOTP_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'

export function base32Encode(bytes: Uint8Array): string {
  let buf = 0, bits = 0, out = ''
  for (const b of bytes) {
    buf = (buf << 8) | b; bits += 8
    while (bits >= 5) { out += _TOTP_ALPHABET[(buf >> (bits - 5)) & 0x1F]; bits -= 5 }
  }
  if (bits > 0) out += _TOTP_ALPHABET[(buf << (5 - bits)) & 0x1F]
  return out
}

export function base32Decode(b32: string): Uint8Array {
  const clean = b32.toUpperCase().replace(/=+$/, '').replace(/\s+/g, '')
  const bytes: number[] = []
  let buf = 0, bits = 0
  for (const ch of clean) {
    const v = _TOTP_ALPHABET.indexOf(ch)
    if (v < 0) continue
    buf = (buf << 5) | v; bits += 5
    if (bits >= 8) { bytes.push((buf >> (bits - 8)) & 0xFF); bits -= 8 }
  }
  return new Uint8Array(bytes)
}

async function _hotp(secret: string, counter: number): Promise<string> {
  const keyBytes = base32Decode(secret)
  // counter 를 8바이트 big-endian 으로
  const cnt = new Uint8Array(8)
  const dv  = new DataView(cnt.buffer)
  dv.setUint32(0, Math.floor(counter / 0x100000000))
  dv.setUint32(4, counter & 0xFFFFFFFF)
  const key   = await crypto.subtle.importKey('raw', keyBytes,
    { name: 'HMAC', hash: 'SHA-1' }, false, ['sign'])
  const sig   = new Uint8Array(await crypto.subtle.sign('HMAC', key, cnt))
  const off   = sig[sig.length - 1] & 0xF
  const code  = ((sig[off] & 0x7F) << 24) |
                ((sig[off + 1] & 0xFF) << 16) |
                ((sig[off + 2] & 0xFF) << 8)  |
                 (sig[off + 3] & 0xFF)
  return String(code % 1000000).padStart(6, '0')
}

export async function verifyTotp(secret: string, code: string, window: number = 1): Promise<boolean> {
  if (!secret || !/^\d{6}$/.test(code)) return false
  const step    = Math.floor(Date.now() / 30000)
  for (let w = -window; w <= window; w++) {
    if (await _hotp(secret, step + w) === code) return true
  }
  return false
}

export function generateTotpSecret(byteLength: number = 20): string {
  const bytes = crypto.getRandomValues(new Uint8Array(byteLength))
  return base32Encode(bytes)
}

export function totpOtpauthUri(issuer: string, account: string, secret: string): string {
  // Authenticator 앱(Google·Authy·1Password 등)이 인식하는 표준 URI
  const enc = encodeURIComponent
  return `otpauth://totp/${enc(issuer)}:${enc(account)}?secret=${secret}&issuer=${enc(issuer)}&algorithm=SHA1&digits=6&period=30`
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
    if (d.count >= perMin) {
      const wait = Math.max(1, Math.ceil((new Date(d.window_start).getTime() + 60_000 - Date.now()) / 1000))
      return { allowed: false, retryAfter: wait }
    }
    if (d.hour_count >= perHour) {
      const wait = Math.max(1, Math.ceil((new Date(d.hour_start).getTime() + 3_600_000 - Date.now()) / 1000))
      return { allowed: false, retryAfter: wait }
    }
    return { allowed: true }
  } catch (_) {
    return { allowed: true }
  }
}
