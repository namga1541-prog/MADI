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
  verifyTotp,
  generateTotpSecret,
  totpOtpauthUri,
  base32Decode,
} from '../_shared/auth.ts'

function makeCORS(origin: string | null): Record<string, string> {
  return makeBaseCORS(origin, { headers: 'authorization, content-type' })
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
    const ok = await verifyTotp(secret, code, 1)
    if (!ok) {
      return new Response(JSON.stringify({ error: '인증 코드가 올바르지 않습니다' }), { status: 401, headers: CORS })
    }
    // DB 에 secret 저장 + totp_enabled=true
    const patchRes = await fetch(SUPA_URL + '/rest/v1/madi_users?id=eq.' + encodeURIComponent(userId), {
      method:  'PATCH',
      headers: { 'Content-Type': 'application/json', 'apikey': SUPA_KEY, 'Authorization': 'Bearer ' + SUPA_KEY },
      body:    JSON.stringify({
        totp_secret:      secret,
        totp_enabled:     true,
        totp_enrolled_at: new Date().toISOString(),
      }),
    })
    if (!patchRes.ok) {
      return new Response(JSON.stringify({ error: 'DB 저장 실패' }), { status: 500, headers: CORS })
    }
    return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { ...CORS, 'Content-Type': 'application/json' } })
  }

  // ── disable: 현재 코드 검증 후 비활성화 ──
  if (body.action === 'disable') {
    const code = (body.code || '').trim()
    if (!/^\d{6}$/.test(code)) {
      return new Response(JSON.stringify({ error: '6자리 코드 필요' }), { status: 400, headers: CORS })
    }
    // 현재 저장된 secret 가져와서 검증
    const r = await fetch(
      SUPA_URL + '/rest/v1/madi_users?id=eq.' + encodeURIComponent(userId) + '&select=totp_secret,totp_enabled',
      { headers: { 'apikey': SUPA_KEY, 'Authorization': 'Bearer ' + SUPA_KEY } }
    )
    const rows = await r.json() as Array<{ totp_secret?: string; totp_enabled?: boolean }>
    const cur  = rows && rows[0]
    if (!cur || !cur.totp_enabled || !cur.totp_secret) {
      return new Response(JSON.stringify({ error: '2FA 가 활성화돼 있지 않습니다' }), { status: 400, headers: CORS })
    }
    const ok = await verifyTotp(cur.totp_secret, code, 1)
    if (!ok) {
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
