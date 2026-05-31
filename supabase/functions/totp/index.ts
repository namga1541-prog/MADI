/**
 * /totp — 2FA(TOTP) 설정·확인·해제 Edge Function (SEC6, 2026-05-24)
 *
 * 인증: JWT 필수
 * 본 함수는 superadmin/admin 만 사용 권장 (학부모·치료사도 자발적 활성화 가능)
 *
 * 요청:
 *   POST { action: 'setup' }
 *     → { secret, otpauth_uri }   (저장은 confirm 단계에서)
 *
 *   POST { action: 'confirm', secret, code }
 *     → { ok: true }              (secret 을 DB 저장, totp_enabled=true)
 *
 *   POST { action: 'disable', code }
 *     → { ok: true }              (현재 코드 검증 후 비활성화)
 *
 *   POST { action: 'status' }
 *     → { enabled: boolean }
 */

import {
  makeCORS as makeBaseCORS,
  getAuthToken,
  verifyJwt,
  generateTotpSecret,
  totpOtpauthUri,
  base32Decode,
  checkRateLimit,
} from '../_shared/auth.ts'

function makeCORS(origin: string | null): Record<string, string> {
  return makeBaseCORS(origin, { headers: 'authorization, content-type' })
}

// ── TOTP 검증 (replay 방지용) ────────────────────────────────────────────
// _shared/auth.ts 의 verifyTotp 는 boolean 만 반환해 매칭된 step 을 알 수 없다.
// replay 거부를 위해 매칭된 절대 step(Math.floor(now/30000)+offset)을 반환하는
// 로컬 구현. 매칭 실패 시 -1. (HOTP 로직은 _shared/auth.ts 와 동일)
async function _hotp(secret: string, counter: number): Promise<string> {
  const keyBytes = base32Decode(secret)
  const cnt = new Uint8Array(8)
  const dv  = new DataView(cnt.buffer)
  dv.setUint32(0, Math.floor(counter / 0x100000000))
  dv.setUint32(4, counter & 0xFFFFFFFF)
  const key = await crypto.subtle.importKey('raw', keyBytes,
    { name: 'HMAC', hash: 'SHA-1' }, false, ['sign'])
  const sig = new Uint8Array(await crypto.subtle.sign('HMAC', key, cnt))
  const off = sig[sig.length - 1] & 0xF
  const code = ((sig[off] & 0x7F) << 24) |
               ((sig[off + 1] & 0xFF) << 16) |
               ((sig[off + 2] & 0xFF) << 8)  |
                (sig[off + 3] & 0xFF)
  return String(code % 1000000).padStart(6, '0')
}

// 매칭된 절대 step 반환(없으면 -1). minStep 이 주어지면 그 이하 step 은 replay 로 거부.
async function verifyTotpStep(
  secret: string, code: string, window: number, minStep: number
): Promise<number> {
  if (!secret || !/^\d{6}$/.test(code)) return -1
  const step = Math.floor(Date.now() / 30000)
  for (let w = -window; w <= window; w++) {
    const s = step + w
    if (minStep >= 0 && s <= minStep) continue   // 사용·만료된 step → replay 거부
    if (await _hotp(secret, s) === code) return s
  }
  return -1
}

Deno.serve(async (req: Request) => {
  const CORS = makeCORS(req.headers.get('origin'))
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })

  const JWT_SECRET = Deno.env.get('MADI_JWT_SECRET')
  const SUPA_URL   = Deno.env.get('SUPABASE_URL')
  const SUPA_KEY   = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!JWT_SECRET || !SUPA_URL || !SUPA_KEY) {
    return new Response(JSON.stringify({ error: '서버 설정 오류' }), { status: 500, headers: CORS })
  }

  const token = getAuthToken(req)
  let user: Record<string, unknown>
  try { user = await verifyJwt(token, JWT_SECRET) } catch {
    return new Response(JSON.stringify({ error: '인증이 필요합니다' }), { status: 401, headers: CORS })
  }

  // ── 세션 무효화 검증: 비밀번호 변경·세션 강제 만료 이후 발급된 토큰인지 확인 ──
  {
    const sub = String(user.sub || '')
    const iat = Number(user.iat || 0)
    const sessRes = await fetch(
      SUPA_URL + '/rest/v1/madi_users?id=eq.' + encodeURIComponent(sub) + '&select=password_changed_at,session_revoked_at',
      { headers: { 'apikey': SUPA_KEY, 'Authorization': 'Bearer ' + SUPA_KEY } }
    )
    if (!sessRes.ok) {
      return new Response(JSON.stringify({ error: '세션 검증 실패 — 잠시 후 다시 시도해주세요' }), { status: 500, headers: CORS })
    }
    const sessRows = await sessRes.json() as Array<{ password_changed_at?: string; session_revoked_at?: string }>
    const sessRow  = sessRows && sessRows[0]
    if (sessRow) {
      const changedAt = sessRow.password_changed_at ? Math.floor(new Date(sessRow.password_changed_at).getTime() / 1000) : 0
      const revokedAt = sessRow.session_revoked_at  ? Math.floor(new Date(sessRow.session_revoked_at).getTime()  / 1000) : 0
      if (iat + 1 < changedAt || iat + 1 < revokedAt) {
        return new Response(JSON.stringify({ error: '세션이 만료되었습니다. 다시 로그인해주세요.' }), { status: 401, headers: CORS })
      }
    }
  }

  let body: { action?: string; secret?: string; code?: string }
  try { body = await req.json() } catch {
    return new Response(JSON.stringify({ error: '잘못된 요청' }), { status: 400, headers: CORS })
  }

  const userId   = String(user.sub || '')
  const username = String(user.username || '')

  // ── status: 현재 등록 여부 조회 ──
  if (body.action === 'status') {
    const r = await fetch(
      SUPA_URL + '/rest/v1/madi_users?id=eq.' + encodeURIComponent(userId) + '&select=totp_enabled',
      { headers: { 'apikey': SUPA_KEY, 'Authorization': 'Bearer ' + SUPA_KEY } }
    )
    if (!r.ok) {
      return new Response(JSON.stringify({ error: 'DB 조회 실패 — 잠시 후 다시 시도해주세요' }), { status: 500, headers: CORS })
    }
    const rows = await r.json() as Array<{ totp_enabled?: boolean }>
    return new Response(
      JSON.stringify({ enabled: !!(rows && rows[0] && rows[0].totp_enabled) }),
      { status: 200, headers: { ...CORS, 'Content-Type': 'application/json' } }
    )
  }

  // ── setup: 새 secret 생성 — 아직 DB 저장 안 함 ──
  // 사용자가 Authenticator 앱에 등록하고 1회 코드로 검증한 뒤(confirm) 저장.
  if (body.action === 'setup') {
    const secret = generateTotpSecret(20)
    const uri    = totpOtpauthUri('MADI(아이마디)', username, secret)
    return new Response(
      JSON.stringify({ secret, otpauth_uri: uri }),
      { status: 200, headers: { ...CORS, 'Content-Type': 'application/json' } }
    )
  }

  // ── confirm: secret + code 검증 후 DB 저장 ──
  if (body.action === 'confirm') {
    // Rate Limit: 사용자별 분당 5·시간당 20 (TOTP 코드 브루트포스 차단)
    const rl = await checkRateLimit('totp:confirm:' + userId, SUPA_URL, SUPA_KEY, 5, 20)
    if (!rl.allowed) {
      return new Response(
        JSON.stringify({ error: `인증 시도가 너무 많습니다. ${rl.retryAfter}초 후 다시 시도해주세요.` }),
        { status: 429, headers: { ...CORS, 'Content-Type': 'application/json', 'Retry-After': String(rl.retryAfter ?? 60) } }
      )
    }

    const secret = (body.secret || '').toUpperCase().replace(/\s+/g, '')
    const code   = (body.code || '').trim()
    if (!secret || !/^[A-Z2-7]{16,64}$/.test(secret)) {
      return new Response(JSON.stringify({ error: 'secret 형식 오류' }), { status: 400, headers: CORS })
    }
    // 디코드 가능 여부도 한 번 검증
    try { base32Decode(secret) } catch {
      return new Response(JSON.stringify({ error: 'secret 디코드 실패' }), { status: 400, headers: CORS })
    }
    if (!/^\d{6}$/.test(code)) {
      return new Response(JSON.stringify({ error: '6자리 숫자 코드를 입력하세요' }), { status: 400, headers: CORS })
    }
    // 신규 등록이라 prior step 없음(minStep=-1) → 매칭 step 반환받아 저장(replay 시드)
    const matchedStep = await verifyTotpStep(secret, code, 1, -1)
    if (matchedStep < 0) {
      return new Response(JSON.stringify({ error: '인증 코드가 올바르지 않습니다' }), { status: 401, headers: CORS })
    }
    // DB 에 secret 저장 + totp_enabled=true
    // totp_last_step: 마이그레이션 적용 전이면 PATCH 실패 가능 → 컬럼 없이 1차 재시도(인증 흐름 유지)
    const basePatch: Record<string, unknown> = {
      totp_secret:      secret,
      totp_enabled:     true,
      totp_enrolled_at: new Date().toISOString(),
    }
    let patchRes = await fetch(SUPA_URL + '/rest/v1/madi_users?id=eq.' + encodeURIComponent(userId), {
      method:  'PATCH',
      headers: { 'Content-Type': 'application/json', 'apikey': SUPA_KEY, 'Authorization': 'Bearer ' + SUPA_KEY },
      body:    JSON.stringify({ ...basePatch, totp_last_step: matchedStep }),
    })
    if (!patchRes.ok) {
      // totp_last_step 컬럼 부재 등으로 실패 시 컬럼 제외하고 재시도 (replay 시드만 생략)
      patchRes = await fetch(SUPA_URL + '/rest/v1/madi_users?id=eq.' + encodeURIComponent(userId), {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json', 'apikey': SUPA_KEY, 'Authorization': 'Bearer ' + SUPA_KEY },
        body:    JSON.stringify(basePatch),
      })
    }
    if (!patchRes.ok) {
      return new Response(JSON.stringify({ error: 'DB 저장 실패' }), { status: 500, headers: CORS })
    }
    return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { ...CORS, 'Content-Type': 'application/json' } })
  }

  // ── disable: 현재 코드 검증 후 비활성화 ──
  if (body.action === 'disable') {
    // Rate Limit: 사용자별 분당 5·시간당 20 (TOTP 코드 브루트포스 차단)
    const rl = await checkRateLimit('totp:disable:' + userId, SUPA_URL, SUPA_KEY, 5, 20)
    if (!rl.allowed) {
      return new Response(
        JSON.stringify({ error: `인증 시도가 너무 많습니다. ${rl.retryAfter}초 후 다시 시도해주세요.` }),
        { status: 429, headers: { ...CORS, 'Content-Type': 'application/json', 'Retry-After': String(rl.retryAfter ?? 60) } }
      )
    }

    const code = (body.code || '').trim()
    if (!/^\d{6}$/.test(code)) {
      return new Response(JSON.stringify({ error: '6자리 코드 필요' }), { status: 400, headers: CORS })
    }
    // 현재 저장된 secret 가져와서 검증.
    // totp_last_step 은 마이그레이션 미적용 환경에서 select 에 포함하면 PostgREST 400 →
    // 컬럼 부재가 인증을 막지 않도록 별도 best-effort 조회로 분리.
    const r = await fetch(
      SUPA_URL + '/rest/v1/madi_users?id=eq.' + encodeURIComponent(userId) + '&select=totp_secret,totp_enabled',
      { headers: { 'apikey': SUPA_KEY, 'Authorization': 'Bearer ' + SUPA_KEY } }
    )
    if (!r.ok) {
      return new Response(JSON.stringify({ error: 'DB 조회 실패 — 잠시 후 다시 시도해주세요' }), { status: 500, headers: CORS })
    }
    const rows = await r.json() as Array<{ totp_secret?: string; totp_enabled?: boolean }>
    const cur  = rows && rows[0]
    if (!cur || !cur.totp_enabled || !cur.totp_secret) {
      return new Response(JSON.stringify({ error: '2FA 가 활성화돼 있지 않습니다' }), { status: 400, headers: CORS })
    }
    // replay 방지: 마지막 성공 step 을 best-effort 로 조회 (컬럼 없거나 실패 시 -1 → replay 검사 생략)
    let lastStep = -1
    try {
      const lr = await fetch(
        SUPA_URL + '/rest/v1/madi_users?id=eq.' + encodeURIComponent(userId) + '&select=totp_last_step',
        { headers: { 'apikey': SUPA_KEY, 'Authorization': 'Bearer ' + SUPA_KEY } }
      )
      if (lr.ok) {
        const lrows = await lr.json() as Array<{ totp_last_step?: number | null }>
        const v = lrows && lrows[0] && lrows[0].totp_last_step
        if (typeof v === 'number') lastStep = v
      }
    } catch (_) { /* 컬럼 부재 등 — replay 검사만 생략, 인증 흐름 유지 */ }

    const matchedStep = await verifyTotpStep(cur.totp_secret, code, 1, lastStep)
    if (matchedStep < 0) {
      return new Response(JSON.stringify({ error: '인증 코드가 올바르지 않습니다' }), { status: 401, headers: CORS })
    }
    const patchRes = await fetch(SUPA_URL + '/rest/v1/madi_users?id=eq.' + encodeURIComponent(userId), {
      method:  'PATCH',
      headers: { 'Content-Type': 'application/json', 'apikey': SUPA_KEY, 'Authorization': 'Bearer ' + SUPA_KEY },
      body:    JSON.stringify({ totp_secret: null, totp_enabled: false, totp_enrolled_at: null }),
    })
    if (!patchRes.ok) {
      return new Response(JSON.stringify({ error: 'DB 저장 실패' }), { status: 500, headers: CORS })
    }
    return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { ...CORS, 'Content-Type': 'application/json' } })
  }

  return new Response(JSON.stringify({ error: 'action 누락 또는 알 수 없는 값' }), { status: 400, headers: CORS })
})
