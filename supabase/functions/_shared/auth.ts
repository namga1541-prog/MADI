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

// ── fetch 타임아웃 래퍼 ────────────────────────────────────────────────────
// 외부 fetch(Supabase REST/RPC, Anthropic 등)가 무기한 매달리는 것을 막는다.
// AbortSignal.timeout(ms) 로 ms 후 자동 abort → 호출부의 기존 try/catch 가 AbortError 를 잡는다.
// init.signal 이 이미 있으면 그것을 존중(호출자 의도 우선), 없으면 timeout signal 을 사용.
export function fetchWithTimeout(url: string | URL, init: RequestInit, ms: number): Promise<Response> {
  const signal = init && init.signal ? init.signal : AbortSignal.timeout(ms)
  return fetch(url, { ...init, signal })
}

// ── CORS ─────────────────────────────────────────────────────────────────
// 'null' Origin 허용 여부는 함수별로 다르므로 옵션으로 분리.
// - change-password / ai-proxy: file:// 로컬 실행 지원 위해 allowNullOrigin=true 로 명시 (login·api 는 false)
// - upload-image / parent-auth: sandboxed iframe CSRF 차단 위해 기본값 false (미설정 시 차단)
// ★ 기본값 변경: allowNullOrigin 미설정 → false (fail-closed). null Origin 허용이 필요한 함수만 명시적으로 true 전달.
export function makeCORS(
  origin: string | null,
  opts: { allowNullOrigin?: boolean; methods?: string; headers?: string } = {}
): Record<string, string> {
  const allowNull = opts.allowNullOrigin === true
  const allowed   = new Set<string>([
    'https://namga1541-prog.github.io',
    'http://localhost:3000',
    'http://127.0.0.1:3000',
  ])
  if (allowNull) allowed.add('null')

  const o    = origin ?? (allowNull ? 'null' : '')
  // 미허용 Origin 은 ACAO 가 요청 Origin 과 불일치 → 브라우저가 응답 읽기를 차단(자격증명 유출 방지).
  // ⚠️ 단 CORS 는 응답 읽기만 막을 뿐 요청 실행(쓰기·푸시·AI 비용)은 막지 못한다.
  //    실제 접근통제는 전적으로 각 함수의 JWT 검증이 담당한다 — CORS 를 보안 경계로 오인 금지(M-23).
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

// ── 클라이언트 IP 추출 (rate-limit 일관성) ─────────────────────────────────
// cf-connecting-ip(Cloudflare 가 세팅하면 위조 불가) 최우선 → x-real-ip → xff 첫 IP.
// login/parent-auth 가 제각각(첫 IP vs 마지막 IP, cf 우선 vs xff 우선)이던 추출을 단일화.
export function getClientIp(req: Request): string {
  const cf = req.headers.get('cf-connecting-ip')
  if (cf && cf.trim()) return cf.trim()
  const xrip = req.headers.get('x-real-ip')
  if (xrip && xrip.trim()) return xrip.trim()
  const xff   = req.headers.get('x-forwarded-for') ?? ''
  const first = xff ? xff.split(',')[0].trim() : ''
  return first || 'unknown'
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

// ── 세션 무효화 검증 (D1) ──────────────────────────────────────────────────
// 로그아웃·비밀번호 변경·관리자 강제 세션종료(session_revoked_at) 이후 발급 전(=옛)
// 토큰을 거부한다. api/index.ts 의 인라인 검증과 동일 의미론을 단일 헬퍼로 추출:
//   · 단위: DB 의 timestamptz 를 Math.floor(getTime()/1000) 로 "초" 단위 변환,
//           payload.iat(초) 와 비교 — api/index.ts(L155,165) 와 동일.
//   · 부등호: tokenIat + 1 < at  → 1초 clock-skew 여유, 동일 초 발급 토큰은 유효
//           (api/index.ts L157,166 과 정확히 동일 방향·여유).
//   · session_revoked_at 컬럼 미존재(마이그레이션 전) 환경을 위해 base 컬럼만으로 retry
//           (api/index.ts L143-149 와 동일한 defensive 패턴).
//   · fail-open: DB 일시 오류·파싱 실패 시 true 반환 — api/index.ts 가 catch(_){} 로
//           검증을 건너뛰고 요청을 계속 처리하는 것과 동일(다른 보안 계층이 막음).
// 반환값: true = 세션 유효(통과), false = 무효(호출측에서 401 반환).
export async function requireFreshSession(
  payload: Record<string, unknown>,
  supaUrl: string,
  supaKey: string,
  opts: { failClosed?: boolean } = {}
): Promise<boolean> {
  // 고위험 엔드포인트(github-deploy 등 코드 배포)는 failClosed=true 로 호출 →
  // DB 검증 불가(일시 오류·사용자 row 없음·예외) 시 통과 대신 거부한다.
  // 일반 읽기/AI/업로드 등 기본 호출은 failClosed 생략 → 기존대로 fail-open(가용성 우선).
  const onError = opts.failClosed === true ? false : true
  try {
    const tokenIat = Number(payload.iat || 0)
    if (!(tokenIat > 0)) return true  // iat 없는 토큰은 본 검증 대상 아님 (api 동일)

    // session_revoked_at 컬럼 미존재면 base 컬럼만으로 retry (api/index.ts 동일)
    let res = await fetchWithTimeout(
      supaUrl + '/rest/v1/madi_users?id=eq.' + encodeURIComponent(String(payload.sub))
        + '&select=password_changed_at,session_revoked_at',
      { headers: { 'apikey': supaKey, 'Authorization': 'Bearer ' + supaKey } },
      8000
    )
    if (!res.ok) {
      // 컬럼 미존재(PostgREST 400)일 때만 base 컬럼으로 retry.
      // 5xx·네트워크 등 일시 오류는 revoke 검증을 조용히 건너뛰지 않도록 onError 로 보낸다
      // (failClosed 면 거부 — 로그아웃/강제종료 무효화의 간헐 누락 방지).
      if (res.status === 400) {
        res = await fetchWithTimeout(
          supaUrl + '/rest/v1/madi_users?id=eq.' + encodeURIComponent(String(payload.sub))
            + '&select=password_changed_at',
          { headers: { 'apikey': supaKey, 'Authorization': 'Bearer ' + supaKey } },
          8000
        )
      } else {
        return onError
      }
    }
    if (!res.ok) return onError  // DB 조회 실패 → failClosed 면 거부

    const rows = await res.json() as Array<{ password_changed_at?: string; session_revoked_at?: string }>
    const row  = rows && rows[0]
    if (!row) return onError  // 사용자 row 없음(삭제 등) → failClosed 면 거부

    if (row.password_changed_at) {
      const pwAt = Math.floor(new Date(row.password_changed_at).getTime() / 1000)
      if (tokenIat + 1 < pwAt) return false
    }
    if (row.session_revoked_at) {
      const rvAt = Math.floor(new Date(row.session_revoked_at).getTime() / 1000)
      if (tokenIat + 1 < rvAt) return false
    }
    return true
  } catch (_) {
    // DB 일시 오류 등 → failClosed 면 거부, 아니면 통과(가용성 우선, 다른 계층이 방어)
    return onError
  }
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

// 매칭된 절대 step 을 반환(없으면 -1). minStep 이 주어지면(>=0) 그 이하 step 은 리플레이로 거부.
//   login 이 마지막 성공 step(totp_last_step)을 넘겨 동일 코드 재사용(캡처 후 재생)을 차단하는 데 사용.
//   totp/index.ts 의 로컬 verifyTotpStep 과 동일 의미론 — 공유 모듈로 단일화.
export async function verifyTotpStep(
  secret: string, code: string, window: number, minStep: number
): Promise<number> {
  if (!secret || !/^\d{6}$/.test(code)) return -1
  const step = Math.floor(Date.now() / 30000)
  for (let w = -window; w <= window; w++) {
    const s = step + w
    if (minStep >= 0 && s <= minStep) continue   // 사용·만료된 step → 리플레이 거부
    if (await _hotp(secret, s) === code) return s
  }
  return -1
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
  perHour: number,
  opts: { failClosed?: boolean } = {}
): Promise<{ allowed: boolean; retryAfter?: number }> {
  // RPC 실패(5xx·네트워크·예외) 시 기본은 fail-open(가용성 우선). failClosed=true 면 차단해
  //   비용(ai-proxy)·브루트포스(totp) 방어가 RPC 장애 시 단일 실패점이 되지 않도록 한다.
  const _onErr = opts.failClosed === true ? false : true
  try {
    const r = await fetchWithTimeout(`${supaUrl}/rest/v1/rpc/madi_rate_limit_hit`, {
      method:  'POST',
      headers: {
        'Authorization': `Bearer ${supaKey}`,
        'apikey':        supaKey,
        'Content-Type':  'application/json',
      },
      body: JSON.stringify({ p_key: key, p_min_window_ms: 60_000, p_hour_window_ms: 3_600_000 }),
    }, 8000)
    if (!r.ok) return { allowed: _onErr }
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
    return { allowed: _onErr }
  }
}
