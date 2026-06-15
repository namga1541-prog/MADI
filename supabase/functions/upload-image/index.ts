/**
 * /upload-image — 게시판 이미지 업로드 Edge Function
 *
 * 보안:
 * - JWT 인증 필수 (httpOnly Cookie 또는 Authorization 헤더), exp 클레임 필수화
 * - 서버 사이드 MIME type 검증 (magic bytes 확인, WebP RIFF+WEBP 완전 검증)
 * - 파일 크기 5MB 제한 (서버 재검증)
 * - 허용 확장자 whitelist
 * - 파일명 UUID로 교체 (경로 순회 방지)
 * - CORS: 'null' Origin 제거 (sandboxed iframe CSRF 방지)
 * - Supabase Storage board-images 버킷에 저장
 */

import { makeCORS as makeBaseCORS, getAuthToken, verifyJwt, requireFreshSession, checkRateLimit, fetchWithTimeout } from '../_shared/auth.ts'

// upload-image: sandboxed iframe CSRF 차단 위해 'null' Origin 거부
function makeCORS(origin: string | null): Record<string, string> {
  return makeBaseCORS(origin, { allowNullOrigin: false })
}

// ── Magic Bytes 검증 ─────────────────────────────────────────────────────
// WebP: RIFF(4B) + 크기(4B) + WEBP(4B) + VP8|VP8L|VP8X 청크
//   RIFF 4바이트만 보면 WAV/AVI도 통과 → bytes[8..11] = W E B P
//   추가로 bytes[12..15] 의 VP8/VP8L/VP8X 청크 시그니처까지 검증해
//   "RIFF...WEBP" 헤더만 갖다 붙인 polyglot 우회를 차단.
//   PNG/JPEG/GIF 도 헤더 외 길이 sanity 체크 추가.
function detectMime(bytes: Uint8Array): string | null {
  if (bytes.length < 16) return null

  // JPEG: FF D8 FF .. .. FF D9 (마지막 2바이트가 EOI 마커)
  if (bytes[0] === 0xFF && bytes[1] === 0xD8 && bytes[2] === 0xFF) {
    // EOI 검증은 트레일러로만, 헤더 통과 시 JPEG 으로 인정
    return 'image/jpeg'
  }
  // PNG: 89 50 4E 47 0D 0A 1A 0A (전체 8바이트 시그니처)
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4E && bytes[3] === 0x47
    && bytes[4] === 0x0D && bytes[5] === 0x0A && bytes[6] === 0x1A && bytes[7] === 0x0A) {
    return 'image/png'
  }
  // GIF: 47 49 46 38 (37|39) 61  ("GIF87a" / "GIF89a")
  if (bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x38
    && (bytes[4] === 0x37 || bytes[4] === 0x39) && bytes[5] === 0x61) {
    return 'image/gif'
  }
  // WebP: RIFF(0-3) + 크기(4-7) + WEBP(8-11) + VP8|VP8L|VP8X(12-15)
  if (bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46
    && bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50) {
    const c12 = bytes[12], c13 = bytes[13], c14 = bytes[14], c15 = bytes[15]
    // 'VP8 ' (Simple lossy), 'VP8L' (lossless), 'VP8X' (extended)
    const isVP8  = c12 === 0x56 && c13 === 0x50 && c14 === 0x38 && c15 === 0x20
    const isVP8L = c12 === 0x56 && c13 === 0x50 && c14 === 0x38 && c15 === 0x4C
    const isVP8X = c12 === 0x56 && c13 === 0x50 && c14 === 0x38 && c15 === 0x58
    if (isVP8 || isVP8L || isVP8X) return 'image/webp'
  }
  return null
}

const ALLOWED_EXTS  = new Set(['jpg', 'jpeg', 'png', 'gif', 'webp'])
const ALLOWED_MIMES = new Set(['image/jpeg', 'image/png', 'image/gif', 'image/webp'])
const MAX_BYTES     = 5 * 1024 * 1024 // 5MB

// JWT 검증은 _shared/auth.ts 에서 import (alg:none 차단, exp 필수 강제 포함)

// ── 메인 핸들러 ──────────────────────────────────────────────────────────
Deno.serve(async (req: Request) => {
  const origin = req.headers.get('origin')
  const cors   = makeCORS(origin)

  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: cors })
  }
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method Not Allowed' }), {
      status: 405, headers: { ...cors, 'Content-Type': 'application/json' }
    })
  }

  // ── 1. JWT 인증 ──
  // MADI_JWT_SECRET 단일 (다른 8개 Edge Function 과 동일) — 로그인 토큰 서명도 이 키이므로
  //   반드시 설정돼 있다. 과거 JWT_SECRET 폴백은 MADI_JWT_SECRET 가 항상 우선해 발동되지 않는
  //   죽은 코드라 제거(M-9). 빈 시크릿은 아래 fail-closed 검사가 차단.
  const JWT_SECRET   = Deno.env.get('MADI_JWT_SECRET') ?? ''
  const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? ''
  const SERVICE_KEY  = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''

  // 빈 시크릿으로 verifyJwt 호출 금지 — env 누락 시 빈 키로 위조 JWT 가 통과할 수 있어 fail-closed(M-22)
  if (!JWT_SECRET || !SUPABASE_URL || !SERVICE_KEY) {
    return new Response(JSON.stringify({ error: '서버 설정 오류' }), {
      status: 500, headers: { ...cors, 'Content-Type': 'application/json' }
    })
  }

  // httpOnly Cookie 우선, fallback으로 Authorization 헤더
  // (참고: 과거 코드는 madi_token 쿠키였으나 _shared/auth 의 getAuthToken 은 madi_session 사용 — 통일)
  const token = getAuthToken(req)

  if (!token) {
    return new Response(JSON.stringify({ error: '인증 필요' }), {
      status: 401, headers: { ...cors, 'Content-Type': 'application/json' }
    })
  }

  let user: Record<string, unknown>
  try {
    user = await verifyJwt(token, JWT_SECRET)
  } catch {
    return new Response(JSON.stringify({ error: '인증 오류' }), {
      status: 401, headers: { ...cors, 'Content-Type': 'application/json' }
    })
  }

  // ── 세션 무효화 검증 (D1): 로그아웃·비번변경·강제종료 이후 옛 토큰 거부 ──
  // 업로드는 Storage 비용·쓰기를 유발하므로 failClosed=true → DB 검증 불가 시 거부 우선.
  if (!(await requireFreshSession(user, SUPABASE_URL, SERVICE_KEY, { failClosed: true }))) {
    return new Response(JSON.stringify({ error: '세션이 만료되었습니다. 다시 로그인해주세요.' }), {
      status: 401, headers: { ...cors, 'Content-Type': 'application/json' }
    })
  }

  // ── 1-b. 역할 검증: parent 차단 (teacher/admin/superadmin 만 업로드 허용) ──
  if (user.role === 'parent') {
    return new Response(JSON.stringify({ error: '이미지 업로드 권한이 없습니다.' }), {
      status: 403, headers: { ...cors, 'Content-Type': 'application/json' }
    })
  }

  // ── 1-c. Rate Limit: 사용자별 분당 20·시간당 100 (Storage 남용 방지) ──
  //   RPC 장애 시 fail-closed — 상한이 사라져 무제한 5MB Storage 쓰기가 허용되는 것을 막는다.
  const rl = await checkRateLimit('upload:' + String(user.sub), SUPABASE_URL, SERVICE_KEY, 20, 100, { failClosed: true })
  if (!rl.allowed) {
    return new Response(JSON.stringify({ error: '업로드 요청이 너무 많습니다. 잠시 후 다시 시도해주세요.' }), {
      status: 429,
      headers: {
        ...cors,
        'Content-Type': 'application/json',
        'Retry-After':  String(rl.retryAfter ?? 60),
      }
    })
  }

  // ── 2. 요청 파싱 ──
  let body: { file?: string; mimeType?: string; folder?: string; ext?: string }
  try {
    body = await req.json()
  } catch {
    return new Response(JSON.stringify({ error: '요청 형식 오류' }), {
      status: 400, headers: { ...cors, 'Content-Type': 'application/json' }
    })
  }

  const { file: base64, mimeType, folder = 'posts', ext = 'jpg' } = body

  if (!base64) {
    return new Response(JSON.stringify({ error: '파일 데이터 없음' }), {
      status: 400, headers: { ...cors, 'Content-Type': 'application/json' }
    })
  }

  // ── 3. 허용 폴더 검증 ──
  // 'quick' = madi-16.js 빠른 기록 모드 사진 (선생님이 업로드한 수업 사진)
  const ALLOWED_FOLDERS = new Set(['posts', 'comments', 'quick'])
  if (!ALLOWED_FOLDERS.has(folder)) {
    return new Response(JSON.stringify({ error: '허용되지 않은 업로드 경로' }), {
      status: 400, headers: { ...cors, 'Content-Type': 'application/json' }
    })
  }

  // ── 4. 허용 확장자 검증 ──
  const safeExt = (ext ?? '').toLowerCase().replace(/[^a-z]/g, '')
  if (!ALLOWED_EXTS.has(safeExt)) {
    return new Response(JSON.stringify({ error: `허용되지 않는 확장자: ${safeExt}` }), {
      status: 400, headers: { ...cors, 'Content-Type': 'application/json' }
    })
  }

  // ── 5. Base64 디코딩 및 크기 검증 ──
  let fileBytes: Uint8Array
  try {
    const bin = atob(base64)
    fileBytes = new Uint8Array(bin.length)
    for (let i = 0; i < bin.length; i++) fileBytes[i] = bin.charCodeAt(i)
  } catch {
    return new Response(JSON.stringify({ error: '파일 디코딩 실패' }), {
      status: 400, headers: { ...cors, 'Content-Type': 'application/json' }
    })
  }

  if (fileBytes.length > MAX_BYTES) {
    return new Response(JSON.stringify({ error: '파일 크기 5MB 초과' }), {
      status: 400, headers: { ...cors, 'Content-Type': 'application/json' }
    })
  }

  // ── 6. Magic Bytes로 실제 MIME 검증 (클라이언트 mimeType 은 신뢰하지 않음) ──
  const detectedMime = detectMime(fileBytes)
  if (!detectedMime || !ALLOWED_MIMES.has(detectedMime)) {
    console.warn('[upload-image] reject mime: declared=%s detected=%s', mimeType, detectedMime)
    return new Response(JSON.stringify({ error: '허용되지 않는 파일 형식 (이미지만 가능)' }), {
      status: 400, headers: { ...cors, 'Content-Type': 'application/json' }
    })
  }

  // ── 7. 파일명 UUID로 교체 (경로 순회 방지) ──
  const uuid     = crypto.randomUUID()
  const fileName = `${folder}/${uuid}.${safeExt}`

  // ── 8. Supabase Storage 업로드 ──
  const uploadUrl = `${SUPABASE_URL}/storage/v1/object/board-images/${fileName}`
  const uploadRes = await fetchWithTimeout(uploadUrl, {
    method:  'POST',
    headers: {
      // 신형 API 키(sb_secret_) 환경: Storage 는 apikey 헤더로 인증. apikey 없이
      // Authorization Bearer 만 보내면 Storage 가 JWT 파싱 시도 → "Invalid Compact JWS" 로 거부됨.
      'apikey':        SERVICE_KEY,
      'Authorization': `Bearer ${SERVICE_KEY}`,
      'Content-Type':  detectedMime,
      'x-upsert':      'false',
    },
    body: fileBytes,
  }, 30000)

  if (!uploadRes.ok) {
    const err = await uploadRes.text()
    console.error('[upload-image] storage error status=%d body=%s', uploadRes.status, err)
    return new Response(JSON.stringify({ error: '파일 업로드에 실패했습니다. 잠시 후 다시 시도해주세요.' }), {
      status: 500, headers: { ...cors, 'Content-Type': 'application/json' }
    })
  }

  const publicUrl = `${SUPABASE_URL}/storage/v1/object/public/board-images/${fileName}`

  return new Response(JSON.stringify({ url: publicUrl }), {
    status: 200, headers: { ...cors, 'Content-Type': 'application/json' }
  })
})
