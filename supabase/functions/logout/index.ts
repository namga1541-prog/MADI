/**
 * /logout — 세션 쿠키 삭제 + session_revoked_at DB 업데이트
 *
 * 요청: POST (인증 불필요 — 쿠키/Bearer 토큰 있으면 best-effort로 DB 무효화)
 * 응답: { ok: true }
 * 효과:
 *   1) madi_session httpOnly 쿠키를 Max-Age=0 으로 만료
 *   2) madi_users.session_revoked_at = 현재 시각 (토큰 재사용 차단)
 *      → JWT가 없거나 파싱 실패해도 (1)은 반드시 진행
 */

import { makeCORS, getAuthToken, verifyJwt, checkRateLimit } from '../_shared/auth.ts'

Deno.serve(async (req: Request) => {
  // ★ [HIGH] allowNullOrigin 제거 — null Origin 응답읽기 차단 (localhost dev 는 유지)
  const CORS = makeCORS(req.headers.get('origin'))
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })

  // 쿠키 만료 헤더 (로그아웃 자체는 항상 성공)
  const clearCookie = 'madi_session=; HttpOnly; Secure; SameSite=None; Path=/; Max-Age=0'

  // ── session_revoked_at 업데이트 (best-effort) ──────────────────────────
  const JWT_SECRET = Deno.env.get('MADI_JWT_SECRET')
  const SUPA_URL   = Deno.env.get('SUPABASE_URL')
  const SUPA_KEY   = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

  if (JWT_SECRET && SUPA_URL && SUPA_KEY) {
    try {
      const token = getAuthToken(req)
      if (token) {
        const payload = await verifyJwt(token, JWT_SECRET)
        const userId  = payload.sub as string
        if (userId) {
          // rate limit — 유일한 쓰기성(무인증 호출 가능) 엔드포인트라 토큰 보유 시 PATCH 반복
          //   호출로 madi_users 쓰기를 무제한 유발할 수 있다. 쿠키 만료(1)는 항상 진행하고
          //   session_revoked_at PATCH(2)만 제한. fail-open(가용성 우선, 기본값).
          const rl = await checkRateLimit(`logout:${userId}`, SUPA_URL, SUPA_KEY, 10, 100)
          if (!rl.allowed) {
            console.warn('[logout] rate limit 초과 — session_revoked_at PATCH 생략(쿠키 만료는 진행)')
          } else {
            const revokedAt = new Date().toISOString()
            const patchRes = await fetch(
              `${SUPA_URL}/rest/v1/madi_users?id=eq.${userId}`,
              {
                method:  'PATCH',
                headers: {
                  'Content-Type':  'application/json',
                  'apikey':        SUPA_KEY,
                  'Authorization': `Bearer ${SUPA_KEY}`,
                  'Prefer':        'return=minimal',
                },
                body: JSON.stringify({ session_revoked_at: revokedAt }),
              }
            )
            if (!patchRes.ok) {
              console.error('[logout] session_revoked_at 업데이트 실패:', patchRes.status)
            }
          }
        }
      }
    } catch (e) {
      // JWT 파싱 실패(만료 토큰 포함) 또는 네트워크 오류 — 로그아웃 자체는 계속 진행
      console.error('[logout] session_revoked_at best-effort 실패:', e)
    }
  }

  return new Response(
    JSON.stringify({ ok: true }),
    { status: 200, headers: { ...CORS, 'Content-Type': 'application/json', 'Set-Cookie': clearCookie } }
  )
})
