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

// ── 공통 인증·CORS·세션검증 유틸 (D4: alg:none/confusion 차단 포함) ──────────
//   기존 인라인 verifyJwt 는 JWT 헤더의 alg 를 검증하지 않아 alg:none / 비대칭→대칭
//   confusion 공격에 노출돼 있었음(D4). _shared/auth.ts 의 verifyJwt 는 alg==='HS256'
//   강제 + exp 필수 검증을 포함하므로 이를 사용해 교체한다.
import {
  makeCORS as makeBaseCORS,
  getAuthToken,
  verifyJwt,
  requireFreshSession,
} from '../_shared/auth.ts'

// github-deploy CORS: 기존과 동일 (null Origin 허용, authorization/content-type 헤더)
function makeCORS(origin: string | null): Record<string, string> {
  return makeBaseCORS(origin, { headers: 'authorization, content-type' })
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
    // GitHub API 에러 메시지를 클라이언트에 그대로 전달하지 않음 — 내부 정보 노출 방지
    console.error('[github-deploy] PUT failed status=%d file=%s', putRes.status, filename)
    throw new Error('파일 업로드 실패: ' + filename)
  }
}

// ── 배포 경로 화이트리스트 ─────────────────────────────────────────────────
const EXACT_ALLOWED = new Set([
  'sw.js', 'manifest.json', 'admin.html', 'index.html', 'madi.css',
  'package.json', 'package-lock.json', 'eslint.config.js', '.eslintrc.json',
  'CLAUDE.md', 'AGENTS.md',
])

const ALLOWED_EXTENSIONS = new Set([
  '.js', '.ts', '.html', '.css', '.json', '.md', '.sql',
  '.svg', '.png', '.ico', '.webmanifest',
])

function isAllowedDeployPath(name: string): boolean {
  // 정확 매칭
  if (EXACT_ALLOWED.has(name)) return true

  // 확장자 선행 검사
  const ext = name.includes('.') ? name.slice(name.lastIndexOf('.')) : ''
  if (!ALLOWED_EXTENSIONS.has(ext)) return false

  // 패턴 매칭
  if (/^madi-[^/\\]+\.js$/.test(name))              return true  // madi-*.js
  if (/^madi-vocab\.js$/.test(name))                 return true  // madi-vocab.js (exact이지만 패턴도 커버)
  if (/^docs\/[^.]+.*\.md$/.test(name))              return true  // docs/**/*.md
  if (/^tests\/[^.]+.*\.js$/.test(name))             return true  // tests/**/*.js
  if (/^supabase\/functions\/.+\.ts$/.test(name))    return true  // supabase/functions/**/*.ts
  if (/^supabase\/sql\/.+\.sql$/.test(name))         return true  // supabase/sql/**/*.sql

  return false
}

// ── 메인 핸들러 ───────────────────────────────────────────────────────────
Deno.serve(async (req: Request) => {
  const CORS = makeCORS(req.headers.get('origin'))
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })

  const JWT_SECRET   = Deno.env.get('MADI_JWT_SECRET')
  const SUPA_URL     = Deno.env.get('SUPABASE_URL')
  const SUPA_KEY     = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  const GITHUB_PAT   = Deno.env.get('GITHUB_PAT')
  const GITHUB_OWNER = Deno.env.get('GITHUB_OWNER') || 'namga1541-prog'
  const GITHUB_REPO  = Deno.env.get('GITHUB_REPO')  || 'MADI'

  if (!JWT_SECRET || !SUPA_URL || !SUPA_KEY) {
    return new Response(JSON.stringify({ error: '서버 설정 오류' }), { status: 500, headers: CORS })
  }
  if (!GITHUB_PAT) {
    return new Response(JSON.stringify({ error: 'GitHub PAT 가 설정되지 않았습니다. Supabase 시크릿을 확인하세요.' }), { status: 500, headers: CORS })
  }

  // 인증 토큰: httpOnly 쿠키 우선, Bearer 헤더 하위 호환 유지
  const token = getAuthToken(req)
  let user: Record<string, unknown>
  // verifyJwt(_shared) 는 alg==='HS256' 강제 + exp 필수 검증 포함 (D4: alg 미검증 결함 해소)
  try { user = await verifyJwt(token, JWT_SECRET) } catch {
    return new Response(JSON.stringify({ error: '인증이 필요합니다' }), { status: 401, headers: CORS })
  }

  // ── 세션 무효화 검증 (D1): 로그아웃·비번변경·강제종료 이후 옛 토큰 거부 ──
  //   소스 코드를 운영에 배포하는 가장 치명적 엔드포인트 — 탈취 토큰 재사용 차단 필수.
  //   failClosed=true: DB 검증 불가 시 통과 대신 거부(fail-open 약점 차단). 배포는 드문
  //   superadmin 작업이라 DB 일시 오류 시 잠깐 막혀도 가용성 영향 미미하고 보안이 우선.
  if (!(await requireFreshSession(user, SUPA_URL, SUPA_KEY, { failClosed: true }))) {
    return new Response(JSON.stringify({ error: '세션이 만료되었습니다. 다시 로그인해주세요.' }), { status: 401, headers: CORS })
  }

  // superadmin 만 배포 가능 (admin·teacher·parent 모두 차단)
  if (user.role !== 'superadmin') {
    return new Response(JSON.stringify({ error: 'superadmin 권한이 필요합니다' }), { status: 403, headers: CORS })
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
      // 경로 순회 및 절대 경로 공격 차단
      if (
        f.name.includes('..') ||
        f.name.includes('..\\') ||
        f.name.startsWith('/') ||
        f.name.startsWith('\\')
      ) {
        return new Response(
          JSON.stringify({ error: '허용되지 않는 경로: ' + f.name }),
          { status: 400, headers: { ...CORS, 'Content-Type': 'application/json' } }
        )
      }
      // 화이트리스트 검증 (F78)
      if (!isAllowedDeployPath(f.name)) {
        return new Response(
          JSON.stringify({ error: '허용되지 않은 파일 경로: ' + f.name }),
          { status: 400, headers: { ...CORS, 'Content-Type': 'application/json' } }
        )
      }
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
