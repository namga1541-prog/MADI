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
  fetchWithTimeout,
} from '../_shared/auth.ts'

// GitHub API 외부 호출 타임아웃 (2-B): 무기한 매달림 방지.
const GITHUB_TIMEOUT_MS = 30000

// github-deploy CORS: 기존과 동일 (null Origin 허용, authorization/content-type 헤더)
function makeCORS(origin: string | null): Record<string, string> {
  return makeBaseCORS(origin, { headers: 'authorization, content-type' })
}

// ── GitHub 다중 파일 원자적 배포 (Git Data API: 단일 커밋) ───────────────────
//   기존 deployFile 은 Contents API 로 파일당 1커밋을 올려, N개 중 k번째에서 실패하면
//   앞 k-1개는 이미 main 에 push 되어 운영 사이트 버전이 불일치(2-A)했다.
//   → blob/tree/commit/ref 4단계로 모든 파일을 하나의 트리로 묶어 단일 커밋으로 atomically
//      반영한다. 중간 단계 실패 시 ref 는 갱신되지 않으므로 main 에 부분 반영이 남지 않는다.
function ghHeaders(pat: string): Record<string, string> {
  return {
    'Authorization': 'token ' + pat,
    'Accept':        'application/vnd.github.v3+json',
    'Content-Type':  'application/json',
    'User-Agent':    'madi-deploy-edge',
  }
}

// UTF-8 안전 Base64
function toB64(content: string): string {
  const bytes = new TextEncoder().encode(content)
  return btoa(Array.from(bytes).map(b => String.fromCharCode(b)).join(''))
}

async function ghJson(
  url: string, init: RequestInit, pat: string, label: string
): Promise<any> {
  const res = await fetchWithTimeout(url, { ...init, headers: ghHeaders(pat) }, GITHUB_TIMEOUT_MS)
  if (!res.ok) {
    // 내부 정보 노출 방지 — 상태코드만 서버 로그에, 클라이언트엔 단계명만.
    console.error('[github-deploy] %s failed status=%d', label, res.status)
    throw new Error('GitHub ' + label + ' 실패')
  }
  return await res.json()
}

async function deployFilesAtomic(
  pat: string, owner: string, repo: string, branch: string,
  files: Array<{ name: string; content: string; commitMsg: string }>
): Promise<void> {
  const apiRepo = `https://api.github.com/repos/${owner}/${repo}`

  // 1) 현재 브랜치 HEAD ref → 최신 커밋 SHA
  const ref = await ghJson(`${apiRepo}/git/ref/heads/${branch}`, { method: 'GET' }, pat, 'ref 조회')
  const baseCommitSha = ref?.object?.sha as string
  if (!baseCommitSha) throw new Error('GitHub ref 조회 실패')

  // 2) 베이스 커밋 → 베이스 트리 SHA
  const baseCommit = await ghJson(`${apiRepo}/git/commits/${baseCommitSha}`, { method: 'GET' }, pat, 'base commit 조회')
  const baseTreeSha = baseCommit?.tree?.sha as string
  if (!baseTreeSha) throw new Error('GitHub base tree 조회 실패')

  // 3) 각 파일을 blob 으로 생성 (UTF-8 → base64) 후 트리 엔트리 구성
  const treeEntries: Array<{ path: string; mode: string; type: string; sha: string }> = []
  for (const f of files) {
    const blob = await ghJson(
      `${apiRepo}/git/blobs`,
      { method: 'POST', body: JSON.stringify({ content: toB64(f.content), encoding: 'base64' }) },
      pat, 'blob 생성',
    )
    if (!blob?.sha) throw new Error('GitHub blob 생성 실패')
    treeEntries.push({ path: f.name, mode: '100644', type: 'blob', sha: blob.sha })
  }

  // 4) base_tree 위에 새 트리 생성 (변경 파일만 덮어씀 — 나머지는 base_tree 유지)
  const newTree = await ghJson(
    `${apiRepo}/git/trees`,
    { method: 'POST', body: JSON.stringify({ base_tree: baseTreeSha, tree: treeEntries }) },
    pat, 'tree 생성',
  )
  if (!newTree?.sha) throw new Error('GitHub tree 생성 실패')

  // 5) 커밋 메시지: 첫 파일의 commitMsg 를 헤드라인으로, 다중이면 파일 수 표기
  const headline = (files[0] && files[0].commitMsg) ? files[0].commitMsg : 'deploy'
  const message  = files.length > 1 ? `${headline} (+${files.length - 1} files)` : headline
  const newCommit = await ghJson(
    `${apiRepo}/git/commits`,
    { method: 'POST', body: JSON.stringify({ message, tree: newTree.sha, parents: [baseCommitSha] }) },
    pat, 'commit 생성',
  )
  if (!newCommit?.sha) throw new Error('GitHub commit 생성 실패')

  // 6) ref 를 새 커밋으로 이동 — 이 단계가 성공해야 비로소 main 에 반영(원자성 보장점).
  //    fast-forward 만 허용(force=false): 동시 배포로 base 가 밀렸으면 실패하고 부분반영 없음.
  await ghJson(
    `${apiRepo}/git/refs/heads/${branch}`,
    { method: 'PATCH', body: JSON.stringify({ sha: newCommit.sha, force: false }) },
    pat, 'ref 갱신',
  )
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
  const GITHUB_OWNER  = Deno.env.get('GITHUB_OWNER')  || 'namga1541-prog'
  const GITHUB_REPO   = Deno.env.get('GITHUB_REPO')   || 'MADI'
  // Pages 가 배포되는 브랜치. Contents API 기본동작(default branch)과 일치시키기 위해 main 기본값.
  const GITHUB_BRANCH = Deno.env.get('GITHUB_BRANCH') || 'main'

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
    const pollRes = await fetchWithTimeout(
      `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/pages/builds/latest`,
      {
        headers: {
          'Authorization': 'token ' + GITHUB_PAT,
          'Accept':        'application/vnd.github+json',
          'User-Agent':    'madi-deploy-edge',
        }
      },
      GITHUB_TIMEOUT_MS
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

    // ── 1단계: 모든 파일 경로 검증 (배포 전에 일괄) ──
    //   원자적 배포이므로 한 파일이라도 부적합하면 아무것도 올리지 않고 거부.
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
    }

    // ── 2단계: 단일 커밋으로 원자적 배포 (2-A) ──
    //   ref 갱신 전 어느 단계에서 실패해도 main 에는 부분 반영이 남지 않는다.
    try {
      await deployFilesAtomic(GITHUB_PAT, GITHUB_OWNER, GITHUB_REPO, GITHUB_BRANCH, files)
    } catch (e) {
      // 부분 반영 없음을 명시 — 사용자는 안전하게 전체 재시도 가능.
      console.error('[github-deploy] atomic deploy failed:', (e as Error).message)
      return new Response(
        JSON.stringify({
          error: '배포에 실패했습니다. 변경사항이 반영되지 않았으니 다시 시도해주세요.',
          atomic: true,           // 부분 적용 없음(원자적) — 클라이언트가 안심하고 재시도
          applied: false,
        }),
        { status: 502, headers: { ...CORS, 'Content-Type': 'application/json' } }
      )
    }

    const results = files.map(f => ({ name: f.name, ok: true }))
    return new Response(
      JSON.stringify({ ok: true, atomic: true, results }),
      { status: 200, headers: { ...CORS, 'Content-Type': 'application/json' } }
    )
  }

  return new Response(JSON.stringify({ error: '알 수 없는 action: ' + action }), { status: 400, headers: CORS })
})
