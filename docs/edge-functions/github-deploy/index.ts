/**
 * /github-deploy — GitHub 배포 프록시 Edge Function
 *
 * 보안:
 * - GitHub PAT 를 클라이언트에 노출하지 않음
 * - Supabase 시크릿 GITHUB_PAT 에서 서버사이드로 읽음
 * - JWT 인증 + admin/superadmin 역할만 배포 가능
 *
 * 요청 헤더: Authorization: Bearer <JWT>
 * 요청 바디:
 *   action = "deploy"  → { action, files: [{name,content,commitMsg}][] }
 *   action = "poll"    → { action, deployStartTs: number }
 *
 * 환경 변수 (Supabase Dashboard → Project Settings → Edge Function Secrets):
 *   GITHUB_PAT      — GitHub Personal Access Token (repo 권한 필요)
 *   GITHUB_OWNER    — 예: "namga1541-prog"
 *   GITHUB_REPO     — 예: "MADI"
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

// ── GitHub 파일 업로드 ────────────────────────────────────────────────────
async function deployFile(
  pat: string, owner: string, repo: string,
  filename: string, content: string, commitMsg: string
): Promise<void> {
  const apiBase = `https://api.github.com/repos/${owner}/${repo}/contents/${filename}`
  const headers = {
    'Authorization': 'token ' + pat,
    'Accept':        'application/vnd.github.v3+json',
    'Content-Type':  'application/json',
    'User-Agent':    'madi-deploy-edge',
  }
  // Base64 인코딩 (UTF-8 안전)
  const encoder = new TextEncoder()
  const bytes   = encoder.encode(content)
  const b64     = btoa(Array.from(bytes).map(b => String.fromCharCode(b)).join(''))

  // 기존 파일 SHA 조회
  const getRes  = await fetch(apiBase, { headers })
  const getInfo = await getRes.json() as { sha?: string; message?: string }

  const body: Record<string, unknown> = { message: commitMsg, content: b64 }
  if (getInfo.sha) body.sha = getInfo.sha

  const putRes = await fetch(apiBase, { method: 'PUT', headers, body: JSON.stringify(body) })
  if (!putRes.ok) {
    const err = await putRes.json() as { message?: string }
    throw new Error(err.message || `${filename} 업로드 실패 (HTTP ${putRes.status})`)
  }
}

// ── 메인 핸들러 ───────────────────────────────────────────────────────────
Deno.serve(async (req: Request) => {
  const CORS = makeCORS(req.headers.get('origin'))
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })

  const JWT_SECRET   = Deno.env.get('MADI_JWT_SECRET')
  const GITHUB_PAT   = Deno.env.get('GITHUB_PAT')
  const GITHUB_OWNER = Deno.env.get('GITHUB_OWNER') || 'namga1541-prog'
  const GITHUB_REPO  = Deno.env.get('GITHUB_REPO')  || 'MADI'

  if (!JWT_SECRET) {
    return new Response(JSON.stringify({ error: '서버 설정 오류' }), { status: 500, headers: CORS })
  }
  if (!GITHUB_PAT) {
    return new Response(JSON.stringify({ error: 'GitHub PAT 가 설정되지 않았습니다. Supabase 시크릿을 확인하세요.' }), { status: 500, headers: CORS })
  }

  // JWT 인증
  const auth  = req.headers.get('Authorization') || ''
  const token = auth.replace('Bearer ', '')
  let user: Record<string, unknown>
  try { user = await verifyJwt(token, JWT_SECRET) } catch {
    return new Response(JSON.stringify({ error: '인증이 필요합니다' }), { status: 401, headers: CORS })
  }

  // admin / superadmin 만 배포 가능
  if (user.role !== 'admin' && user.role !== 'superadmin') {
    return new Response(JSON.stringify({ error: '관리자 권한이 필요합니다' }), { status: 403, headers: CORS })
  }

  let body: Record<string, unknown>
  try { body = await req.json() } catch {
    return new Response(JSON.stringify({ error: '잘못된 요청 형식' }), { status: 400, headers: CORS })
  }

  const action = body.action as string

  // ─ poll: GitHub Pages 빌드 상태 조회 ────────────────────────────────────
  if (action === 'poll') {
    const deployStartTs = body.deployStartTs as number || 0
    const pollRes = await fetch(
      `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/pages/builds/latest`,
      {
        headers: {
          'Authorization': 'token ' + GITHUB_PAT,
          'Accept':        'application/vnd.github+json',
          'User-Agent':    'madi-deploy-edge',
        }
      }
    )
    if (!pollRes.ok) {
      return new Response(JSON.stringify({ error: 'GitHub Pages 빌드 상태 조회 실패' }), { status: pollRes.status, headers: CORS })
    }
    const build = await pollRes.json()
    return new Response(JSON.stringify(build), { status: 200, headers: { ...CORS, 'Content-Type': 'application/json' } })
  }

  // ─ deploy: 파일 배포 ─────────────────────────────────────────────────────
  if (action === 'deploy') {
    const files = body.files as Array<{ name: string; content: string; commitMsg: string }>
    if (!Array.isArray(files) || files.length === 0) {
      return new Response(JSON.stringify({ error: '배포할 파일이 없습니다' }), { status: 400, headers: CORS })
    }

    const results: Array<{ name: string; ok: boolean; error?: string }> = []

    for (const f of files) {
      try {
        await deployFile(GITHUB_PAT, GITHUB_OWNER, GITHUB_REPO, f.name, f.content, f.commitMsg)
        results.push({ name: f.name, ok: true })
      } catch (e) {
        results.push({ name: f.name, ok: false, error: (e as Error).message })
        // 첫 번째 실패 시 중단 (SHA 충돌 방지)
        return new Response(
          JSON.stringify({ error: f.name + ' 업로드 실패: ' + (e as Error).message, results }),
          { status: 500, headers: { ...CORS, 'Content-Type': 'application/json' } }
        )
      }
    }

    return new Response(
      JSON.stringify({ ok: true, results }),
      { status: 200, headers: { ...CORS, 'Content-Type': 'application/json' } }
    )
  }

  return new Response(JSON.stringify({ error: '알 수 없는 action: ' + action }), { status: 400, headers: CORS })
})
