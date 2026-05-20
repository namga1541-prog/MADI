/**
 * /upload-image — 게시판 이미지 업로드 Edge Function
 *
 * 보안:
 * - JWT 인증 필수 (httpOnly Cookie 또는 Authorization 헤더)
 * - 서버 사이드 MIME type 검증 (magic bytes 확인)
 * - 파일 크기 5MB 제한 (서버 재검증)
 * - 허용 확장자 whitelist
 * - 파일명 UUID로 교체 (경로 순회 방지)
 * - Supabase Storage board-images 버킷에 저장
 */

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
    'Access-Control-Allow-Credentials': 'true',
    'Vary': 'Origin',
  }
}

// ── Magic Bytes 검증 (클라이언트 MIME 우회 방지) ──────────────────────────
const MAGIC: Record<string, number[][]> = {
  'image/jpeg': [[0xFF, 0xD8, 0xFF]],
  'image/png':  [[0x89, 0x50, 0x4E, 0x47]],
  'image/gif':  [[0x47, 0x49, 0x46, 0x38]],
  'image/webp': [[0x52, 0x49, 0x46, 0x46]], // RIFF....WEBP
}

const ALLOWED_EXTS = new Set(['jpg', 'jpeg', 'png', 'gif', 'webp'])
const ALLOWED_MIMES = new Set(Object.keys(MAGIC))
const MAX_BYTES = 5 * 1024 * 1024 // 5MB

function detectMime(bytes: Uint8Array): string | null {
  for (const [mime, magicList] of Object.entries(MAGIC)) {
    for (const magic of magicList) {
      if (magic.every((b, i) => bytes[i] === b)) return mime
    }
  }
  return null
}

// ── JWT 검증 ─────────────────────────────────────────────────────────────
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
  const valid = await crypto.subtle.verify(
    'HMAC', key, sigBytes,
    new TextEncoder().encode(`${header}.${body}`)
  )
  if (!valid) throw new Error('JWT 서명 불일치')
  const payload = JSON.parse(atob(body.replace(/-/g, '+').replace(/_/g, '/')))
  if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) throw new Error('JWT 만료')
  return payload
}

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
  const JWT_SECRET  = Deno.env.get('JWT_SECRET') ?? ''
  const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? ''
  const SERVICE_KEY  = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''

  // httpOnly Cookie 또는 Authorization 헤더에서 토큰 추출
  let token = ''
  const cookieHeader = req.headers.get('cookie') ?? ''
  const cookieMatch  = cookieHeader.match(/madi_token=([^;]+)/)
  if (cookieMatch) {
    token = cookieMatch[1]
  } else {
    const authHeader = req.headers.get('authorization') ?? ''
    token = authHeader.replace(/^Bearer\s+/i, '')
  }

  if (!token) {
    return new Response(JSON.stringify({ error: '인증 필요' }), {
      status: 401, headers: { ...cors, 'Content-Type': 'application/json' }
    })
  }

  try {
    await verifyJwt(token, JWT_SECRET)
  } catch (e) {
    return new Response(JSON.stringify({ error: '인증 실패: ' + (e as Error).message }), {
      status: 401, headers: { ...cors, 'Content-Type': 'application/json' }
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
  const ALLOWED_FOLDERS = new Set(['posts', 'comments'])
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

  // ── 6. Magic Bytes로 실제 MIME 검증 (클라이언트 우회 방지) ──
  const detectedMime = detectMime(fileBytes)
  if (!detectedMime) {
    return new Response(JSON.stringify({ error: '허용되지 않는 파일 형식 (이미지만 가능)' }), {
      status: 400, headers: { ...cors, 'Content-Type': 'application/json' }
    })
  }
  if (!ALLOWED_MIMES.has(mimeType ?? '') || detectedMime !== mimeType) {
    return new Response(JSON.stringify({ error: `파일 형식 불일치: 선언=${mimeType}, 실제=${detectedMime}` }), {
      status: 400, headers: { ...cors, 'Content-Type': 'application/json' }
    })
  }

  // ── 7. 파일명 UUID로 교체 (경로 순회 방지) ──
  const uuid     = crypto.randomUUID()
  const fileName = `${folder}/${uuid}.${safeExt}`

  // ── 8. Supabase Storage 업로드 ──
  const uploadUrl = `${SUPABASE_URL}/storage/v1/object/board-images/${fileName}`
  const uploadRes = await fetch(uploadUrl, {
    method:  'POST',
    headers: {
      'Authorization':    `Bearer ${SERVICE_KEY}`,
      'Content-Type':     detectedMime,
      'x-upsert':         'false',
    },
    body: fileBytes,
  })

  if (!uploadRes.ok) {
    const err = await uploadRes.text()
    return new Response(JSON.stringify({ error: '스토리지 업로드 실패: ' + err }), {
      status: 500, headers: { ...cors, 'Content-Type': 'application/json' }
    })
  }

  const publicUrl = `${SUPABASE_URL}/storage/v1/object/public/board-images/${fileName}`

  return new Response(JSON.stringify({ url: publicUrl }), {
    status: 200, headers: { ...cors, 'Content-Type': 'application/json' }
  })
})
