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
import { makeCORS, getAuthToken, verifyJwt, checkRateLimit, requireFreshSession, signJwt } from '../_shared/auth.ts'

// ── 비밀번호 유틸 ──────────────────────────────────────────────────────────
async function sha256Hex(s: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s))
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('')
}

async function verifyPassword(plain: string, stored: string): Promise<boolean> {
  if (stored.startsWith('$2')) {
    if (await bcrypt.compare(plain, stored)) return true
    // 회원가입 시 클라이언트가 SHA-256 해시를 전송한 계정: 저장값이 bcrypt(sha256(plain))
    // login 의 verifyPassword 와 동일하게 처리 — 미로그인 계정도 비번 변경 가능하도록.
    return await bcrypt.compare(await sha256Hex(plain), stored)
  }
  return (await sha256Hex(plain)) === stored
}

// ── 메인 핸들러 ───────────────────────────────────────────────────────────
Deno.serve(async (req: Request) => {
  const CORS = makeCORS(req.headers.get('origin'), { allowNullOrigin: true })
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })

  const JWT_SECRET = Deno.env.get('MADI_JWT_SECRET')
  const SUPA_URL   = Deno.env.get('SUPABASE_URL')
  const SUPA_KEY   = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

  if (!JWT_SECRET || !SUPA_URL || !SUPA_KEY) {
    return new Response(JSON.stringify({ error: '서버 설정 오류' }), { status: 500, headers: CORS })
  }

  // 인증 토큰: httpOnly 쿠키 우선, Bearer 헤더 하위 호환 유지
  const token = getAuthToken(req)
  let user: Record<string, unknown>
  try { user = await verifyJwt(token, JWT_SECRET) } catch {
    return new Response(JSON.stringify({ error: '인증이 필요합니다' }), { status: 401, headers: CORS })
  }

  // 세션 무효화 검증 — 로그아웃·강제종료된 토큰으로는 비번 변경 불가 (failClosed: 고위험 작업)
  if (!(await requireFreshSession(user, SUPA_URL, SUPA_KEY, { failClosed: true }))) {
    return new Response(JSON.stringify({ error: '세션이 만료되었습니다. 다시 로그인해주세요.' }), { status: 401, headers: CORS })
  }

  // ── Rate Limit: 사용자별 분당 3회 / 시간당 5회 ──
  // failClosed: RPC 장애 시에도 분당 상한을 유지 — 탈취 세션으로 현재 비번 무제한 추측 방지
  const rl = await checkRateLimit(`pwchange:${String(user.sub)}`, SUPA_URL, SUPA_KEY, 3, 5, { failClosed: true })
  if (!rl.allowed) {
    return new Response(
      JSON.stringify({ error: `비밀번호 변경 시도가 너무 많습니다. ${rl.retryAfter}초 후 다시 시도해주세요.` }),
      { status: 429, headers: { ...CORS, 'Content-Type': 'application/json', 'Retry-After': String(rl.retryAfter ?? 60) } }
    )
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
  // 현재 비밀번호도 길이 상한 — bcrypt.compare 호출 전 과대 입력 차단(newPw 와 동일 기준).
  if (currentPw.length > 128) {
    return new Response(JSON.stringify({ error: '현재 비밀번호가 너무 깁니다' }), { status: 400, headers: CORS })
  }
  // 비밀번호 최소 길이: 4자 (베타 기간 — 정식 배포 시 8자로 변경)
  if (newPw.length < 4) {
    return new Response(JSON.stringify({ error: '새 비밀번호는 4자 이상이어야 합니다' }), { status: 400, headers: CORS })
  }
  if (newPw.length > 128) {
    return new Response(JSON.stringify({ error: '새 비밀번호는 128자 이하여야 합니다' }), { status: 400, headers: CORS })
  }
  if (currentPw === newPw) {
    return new Response(JSON.stringify({ error: '현재 비밀번호와 동일합니다' }), { status: 400, headers: CORS })
  }

  // DB에서 현재 해시 조회
  const dbRes = await fetch(
    SUPA_URL + '/rest/v1/madi_users?id=eq.' + user.sub + '&select=password',
    { headers: { 'apikey': SUPA_KEY, 'Authorization': 'Bearer ' + SUPA_KEY } }
  )
  if (!dbRes.ok) {
    return new Response(JSON.stringify({ error: '사용자 조회 실패 — 잠시 후 다시 시도해주세요' }), { status: 500, headers: CORS })
  }
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

  const changedAtMs = Date.now()
  const patchRes = await fetch(
    SUPA_URL + '/rest/v1/madi_users?id=eq.' + user.sub,
    {
      method:  'PATCH',
      headers: { 'Content-Type': 'application/json', 'apikey': SUPA_KEY, 'Authorization': 'Bearer ' + SUPA_KEY },
      // password_changed_at 도 함께 업데이트 → 이 시각 이전에 발급된 모든 JWT 가 api 에서 거부됨
      body:    JSON.stringify({ password: newHash, password_changed_at: new Date(changedAtMs).toISOString() }),
    }
  )
  if (!patchRes.ok) {
    return new Response(JSON.stringify({ error: '비밀번호 변경 실패 — 잠시 후 다시 시도해주세요' }), { status: 500, headers: CORS })
  }

  // 비번 변경 시 password_changed_at 갱신으로 기존 토큰(다른 기기 포함)이 모두 무효화된다.
  // 본인(요청한 기기)은 끊기지 않도록 새 JWT 쿠키를 발급(회전). iat = password_changed_at 초라
  // requireFreshSession 의 `tokenIat+1 < pwAt` 검사를 본인 새 토큰만 통과한다(다른 기기 옛 토큰은 거부).
  const iat = Math.floor(changedAtMs / 1000)
  const newPayload: Record<string, unknown> = {
    sub:       user.sub,
    username:  user.username,
    name:      user.name,
    role:      user.role,
    center_id: user.center_id,
    iat,
    exp:       iat + 24 * 3600,
  }
  if (user.parent_child_id !== undefined) newPayload.parent_child_id = user.parent_child_id
  const newToken     = await signJwt(newPayload, JWT_SECRET)
  const cookieHeader = `madi_session=${newToken}; HttpOnly; Secure; SameSite=None; Path=/; Max-Age=86400`

  return new Response(
    JSON.stringify({ ok: true, sessions_invalidated: true }),
    { status: 200, headers: { ...CORS, 'Content-Type': 'application/json', 'Set-Cookie': cookieHeader } }
  )
})
