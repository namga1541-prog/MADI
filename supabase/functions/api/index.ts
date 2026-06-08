import { makeCORS as makeBaseCORS, getAuthToken, verifyJwt, requireFreshSession } from '../_shared/auth.ts'

// api 함수는 x-client-info, apikey 헤더도 허용 (Supabase 클라이언트 SDK 호환)
function makeCORS(origin: string | null): Record<string, string> {
  return makeBaseCORS(origin, { headers: 'authorization, content-type, x-client-info, apikey' })
}

const ALLOWED_TABLES = [
  'madi_users', 'madi_centers', 'madi_children', 'madi_sessions',
  'madi_schedules', 'madi_assessments', 'madi_activities',
  'madi_iep_history', 'madi_notices', 'madi_settings', 'madi_programs',
  'madi_global_notices', 'madi_lounge_posts', 'madi_lounge_comments', 'madi_parent_invites',
  'madi_parent_children', 'madi_push_subscriptions', 'madi_push_settings', 'madi_licenses', 'madi_error_logs', 'madi_notifications',
  'madi_portfolios', 'madi_parent_observations'
]

// 관리자 이상만 모든 조작 가능
const ADMIN_ONLY_TABLES = [
  'madi_users', 'madi_centers', 'madi_settings', 'madi_error_logs', 'madi_licenses',
  'madi_push_settings',
]

// 읽기는 전체 허용, 쓰기(POST·PATCH·DELETE)는 admin 이상만
const ADMIN_WRITE_TABLES = [
  'madi_notices', 'madi_programs',
]

// 읽기는 전체 허용, 쓰기는 superadmin만
const SUPERADMIN_WRITE_TABLES = [
  'madi_global_notices',
]

// 전역 테이블 (center_id 컬럼 없음)
const GLOBAL_TABLES = [
  'madi_global_notices', 'madi_lounge_comments', 'madi_push_subscriptions', 'madi_settings'
]

// ★ UPSERT(merge-duplicates) 허용 테이블 화이트리스트.
//   POST 시 임의 PK 지정으로 타 row 를 덮어쓰는 IDOR 를 막기 위해, 실제 클라이언트가
//   upsert 에 의존하는 테이블만 merge-duplicates 를 부여하고 그 외엔 일반 insert.
//   조사(클라이언트 supaFetch POST 사용처) 근거:
//   · madi_children/sessions/schedules/assessments/iep_history/activities
//       → madi-01-app.js·madi-12.js 가 `?on_conflict=id` + id 포함 row 로 동기화(재저장 시 갱신)
//   · madi_settings → madi-03.js 가 {key:'api_key', value} 를 PK(key) 충돌로 재저장(키 덮어쓰기)
//   이 외 POST(회원가입·공지·알림·라운지·포트폴리오·푸시구독 등)는 전부 auto-PK 신규 insert 라
//   merge-duplicates 불필요 → 화이트리스트에서 제외.
const UPSERT_TABLES = [
  'madi_children', 'madi_sessions', 'madi_schedules', 'madi_assessments',
  'madi_iep_history', 'madi_activities', 'madi_settings',
]

// 학부모 쓰기 금지 테이블 — 임상 데이터 위변조 방지
const PARENT_READONLY_TABLES = [
  'madi_children', 'madi_sessions', 'madi_schedules',
  'madi_assessments', 'madi_activities', 'madi_iep_history',
  'madi_programs', 'madi_notices', 'madi_portfolios'
]

// ★ 학부모 전체 차단 테이블 — READ 도 불허 (선생님 보호 정책 2026-05-21)
// 세션 기록은 학부모에게 노출되지 않고, 가시성 OPEN 된 madi_portfolios 만 정제된 단일 채널로 사용.
const PARENT_BLOCKED_TABLES = [
  'madi_sessions'
]

// ★ 학부모 허용 테이블 화이트리스트 — default-deny (라운지·내부 데이터 유출 차단)
//   ALLOWED_TABLES 에 새 테이블이 추가돼도 이 목록에 없으면 학부모는 자동 403.
//   라운지(madi_lounge_posts/comments)·초대(madi_parent_invites) 등 스태프 내부 채널은 의도적으로 제외.
const PARENT_ALLOWED_TABLES = [
  // 임상 데이터 (center_id + child_id + parent_visible 필터는 아래 학부모 READ 블록에서 강제)
  'madi_children', 'madi_schedules', 'madi_assessments',
  'madi_activities', 'madi_iep_history', 'madi_programs',
  'madi_notices', 'madi_portfolios',
  // user_id 스코프 (알림·아동 연결·학부모 관찰기록)
  'madi_parent_children', 'madi_notifications', 'madi_parent_observations',
  // 본인 푸시 구독 (GET 은 아래에서 user_id 소유 스코프)
  'madi_push_subscriptions',
  // 전역 공지 (읽기 전용 안내)
  'madi_global_notices',
]

// 학부모 user_id 스코프 테이블
const PARENT_USER_SCOPED: Record<string, string> = {
  'madi_parent_children':      'parent_user_id',
  'madi_notifications':        'user_id',
  // 학부모 관찰기록 — GET 은 parent_user_id=eq.본인, POST 는 parent_user_id 를 JWT sub 로 강제(위장 방지, M-3)
  'madi_parent_observations':  'parent_user_id',
}

// ── 클라이언트 감사 이벤트(madi_audit_log POST) 허용 action 목록 ────────────
// 클라가 보내는 action 값 중 서버가 수용하는 화이트리스트. 목록 밖 값은 'client_other'로 정규화.
// (실제 사용처: madi-core.js _reportClientError, madi-child-detail.js deleteChild,
//  madi-system.js savePermissions/deleteStaff, madi-board.js vocab feedback)
const AUDIT_CLIENT_ACTIONS = new Set([
  'client_error', 'DELETE_CHILD', 'UPDATE_PERMISSIONS', 'DELETE_STAFF', 'vocab_feedback',
])

// ── 클라이언트 감사 이벤트 서버 정제 INSERT ──────────────────────────────────
// 클라 body 를 그대로 PostgREST 로 넘기지 않고, 서버가 필드를 정제·강제해 service_role 로 INSERT.
//   · actor_id/actor_role/center_id 는 JWT 에서 강제(클라 위조 무시).
//   · action 은 화이트리스트로 제한, 밖이면 'client_other'.
//   · row_id/child_id/table_name 은 클라 값 허용하되 문자열화·길이 200 제한.
//   · changed_cols(text[]) 는 배열만 수용, 각 원소 문자열화·길이 2000 제한, 최대 20개.
//   · ⚠️ SCHEMA.md 의 실제 컬럼만 사용. record_id 로 와도 row_id 로 매핑(현재 클라는 row_id 사용).
async function insertClientAudit(
  supaUrl: string,
  supaKey: string,
  user: Record<string, unknown>,
  rawBody: unknown,
): Promise<Response> {
  const CORS_H = { 'Content-Type': 'application/json' }
  const src = Array.isArray(rawBody) ? rawBody[0] : rawBody
  if (!src || typeof src !== 'object') {
    return new Response(JSON.stringify({ error: '잘못된 감사 페이로드' }), { status: 400, headers: CORS_H })
  }
  const c = src as Record<string, unknown>
  const str200 = (v: unknown): string | null => (v != null ? String(v).slice(0, 200) : null)

  // action 화이트리스트 정규화
  const rawAction = c.action != null ? String(c.action) : ''
  const action = AUDIT_CLIENT_ACTIONS.has(rawAction) ? rawAction : 'client_other'

  // changed_cols(text[]) — 배열만 수용. 클라는 [JSON.stringify({...})] 또는 ['permissions','role'] 전송.
  let changedCols: string[] | null = null
  if (Array.isArray(c.changed_cols)) {
    changedCols = c.changed_cols.slice(0, 20).map((x) => String(x).slice(0, 2000))
  }

  // row_id: 클라가 record_id 로 보냈을 가능성도 흡수(현재 클라는 row_id 사용).
  const rowId = c.row_id != null ? str200(c.row_id) : str200(c.record_id)

  const insertRow: Record<string, unknown> = {
    actor_id:    user.sub  != null ? String(user.sub)  : null,   // JWT 강제(위조 방지)
    actor_role:  user.role != null ? String(user.role) : null,   // JWT 강제
    action:      action,
    table_name:  str200(c.table_name),
    row_id:      rowId,
    center_id:   user.center_id != null ? String(user.center_id) : null,  // JWT 강제
    child_id:    str200(c.child_id),
    changed_cols: changedCols,
  }

  try {
    const res = await fetch(`${supaUrl}/rest/v1/madi_audit_log`, {
      method:  'POST',
      headers: {
        'Authorization': `Bearer ${supaKey}`,
        'apikey':        supaKey,
        'Content-Type':  'application/json',
        'Prefer':        'return=minimal',
      },
      body: JSON.stringify(insertRow),
    })
    if (!res.ok) {
      console.error('[api] audit insert fail', res.status, (await res.text()).slice(0, 300))
      // 클라는 .catch(()=>{}) 로 무시하므로 상태만 전달(내부 구조 비노출)
      return new Response(JSON.stringify({ ok: false }), { status: res.status, headers: CORS_H })
    }
    return new Response(JSON.stringify({ ok: true }), { status: 201, headers: CORS_H })
  } catch (e) {
    console.error('[api] audit insert error', (e as Error).message)
    return new Response(JSON.stringify({ ok: false }), { status: 500, headers: CORS_H })
  }
}

// ── 민감 설정 SELECT 감사 ──────────────────────────────────────────────
// 외부 보안 감사 후속 (2026-05-23) — admin 권한자가 madi_settings(특히 api_key) 를
// 조회한 흐름을 madi_audit_log 에 기록. fire-and-forget — 로깅 실패는 본 요청에 영향 X.
async function logSettingsAccess(
  supaUrl: string,
  supaKey: string,
  user: Record<string, unknown>,
  req: Request,
  path: string,
  method: string,
): Promise<void> {
  try {
    // ?key=eq.<XXX> 또는 ?key=in.(...) 패턴에서 조회 대상 키 식별 (없으면 'all')
    let keyName = 'all'
    const m = path.match(/[?&]key=(?:eq|in)\.([^&]+)/)
    if (m) keyName = decodeURIComponent(m[1]).slice(0, 64)

    await fetch(`${supaUrl}/rest/v1/madi_audit_log`, {
      method:  'POST',
      headers: {
        'Authorization': `Bearer ${supaKey}`,
        'apikey':        supaKey,
        'Content-Type':  'application/json',
        'Prefer':        'return=minimal',
      },
      body: JSON.stringify({
        actor_id:    user.sub      ?? null,
        actor_role:  user.role     ?? null,
        action:      (!method || method === 'GET') ? 'SELECT' : method,
        table_name:  'madi_settings',
        row_id:      keyName,
      }),
    })
  } catch (_) { /* fire-and-forget */ }
}

// ── 동의/증빙 감사 기록 (PIPA) ────────────────────────────────────────────
// 동의(가입·아동등록)를 madi_audit_log 에 append-only 증빙으로 1행 기록한다.
//   best-effort: 이 INSERT 실패가 가입/아동생성 본 요청을 실패시키면 안 되므로 try/catch.
//   ⚠️ madi_audit_log 의 실제 컬럼만 사용(SCHEMA.md): actor_id, actor_role, action,
//      table_name, row_id, center_id, child_id. (record_id/actor_name 컬럼은 존재하지 않음.)
//   민감정보(version·sensitive 여부)는 row_id 문자열에 packing — 스키마 변경 없음.
async function logConsentAudit(
  supaUrl: string,
  supaKey: string,
  fields: {
    action: string
    actorId?: unknown
    actorRole?: unknown
    rowId?: unknown
    centerId?: unknown
    childId?: unknown
  },
): Promise<void> {
  try {
    await fetch(`${supaUrl}/rest/v1/madi_audit_log`, {
      method:  'POST',
      headers: {
        'Authorization': `Bearer ${supaKey}`,
        'apikey':        supaKey,
        'Content-Type':  'application/json',
        'Prefer':        'return=minimal',
      },
      body: JSON.stringify({
        actor_id:   fields.actorId   != null ? String(fields.actorId)   : null,
        actor_role: fields.actorRole != null ? String(fields.actorRole) : null,
        action:     fields.action,
        table_name: 'consent',
        row_id:     fields.rowId   != null ? String(fields.rowId).slice(0, 200) : null,
        center_id:  fields.centerId != null ? String(fields.centerId) : null,
        child_id:   fields.childId  != null ? String(fields.childId)  : null,
      }),
    })
  } catch (_) { /* best-effort 증빙 — 실패해도 본 요청에 영향 없음 */ }
}

// ★ 학부모 child_id 기반 필터가 필요한 테이블 (data JSON 내 childId 필드)
const PARENT_CHILD_FILTER_TABLES = [
  'madi_sessions', 'madi_schedules', 'madi_assessments', 'madi_iep_history'
]

// ★ child_id 가 실 컬럼인 테이블 (data JSON 아님) — 별도 처리
const PARENT_CHILD_COLUMN_TABLES = [
  'madi_portfolios'
]

// ★ 학부모에게 노출하기 전 parent_visible 플래그를 강제 검사할 테이블
// 선생님이 명시적으로 OPEN 한 row 만 학부모가 볼 수 있음.
const PARENT_VISIBLE_GATED_TABLES = [
  'madi_portfolios'
]

Deno.serve(async (req: Request) => {
  const CORS = makeCORS(req.headers.get('origin'))
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

  try {
    user = await verifyJwt(token, JWT_SECRET)
  } catch {
    return new Response(JSON.stringify({ error: '인증이 필요합니다. 다시 로그인해주세요.' }), { status: 401, headers: CORS })
  }

  // 요청 본문 파싱 — 세션 무효화 검증의 fail-closed 판단(쓰기 여부)에 method 가 필요하므로 먼저 읽는다.
  let reqBody: { path: string; method?: string; body?: unknown; consent?: unknown }
  try {
    reqBody = await req.json() as { path: string; method?: string; body?: unknown; consent?: unknown }
  } catch {
    return new Response(JSON.stringify({ error: '잘못된 요청 형식입니다.' }), { status: 400, headers: CORS })
  }
  const method  = reqBody.method
  const body    = reqBody.body
  let   path    = reqBody.path   // 정제·재작성 가능하도록 let
  // ★ [PIPA] 치료사 가입 동의 페이로드(고정 계약): consent = { agreed, sensitive, version }.
  //   하위호환: 구버전 클라(consent 미전송) 는 undefined → 동의 로깅만 생략하고 가입은 정상 진행.
  const consent = (reqBody.consent && typeof reqBody.consent === 'object')
    ? reqBody.consent as { agreed?: unknown; sensitive?: unknown; version?: unknown }
    : null
  const isWrite = method === 'POST' || method === 'PATCH' || method === 'PUT' || method === 'DELETE'

  // ── 세션 무효화 검증 (H-3: 쓰기 요청은 fail-closed) ──
  // ① 비밀번호 변경 시 (password_changed_at) → 옛 토큰 거부
  // ② 강제 로그아웃 시 (session_revoked_at, SEC3) → admin 이 즉시 강등 가능
  // 쓰기(POST/PATCH/PUT/DELETE)는 DB 검증 불가(5xx·네트워크·예외) 시에도 거부(failClosed)하여
  //   무효화된 세션의 데이터 변조를 차단한다. 읽기는 가용성 우선 fail-open 유지.
  //   (컬럼 미존재 400 retry 등은 _shared/requireFreshSession 이 일관 처리)
  const sessionFresh = await requireFreshSession(user, SUPA_URL, SUPA_KEY, { failClosed: isWrite })
  if (!sessionFresh) {
    return new Response(
      JSON.stringify({ error: '세션이 만료되었습니다. 다시 로그인해주세요.' }),
      { status: 401, headers: CORS }
    )
  }

  try {
    const tableName = path.split('?')[0].split('&')[0]

    // ★ Storage 서명 URL 발급 — board-images 비공개 전환 대비.
    //   인증된 사용자(verifyJwt 통과)만 호출. body.paths 의 각 항목(public URL·서명 URL·생경로 모두 허용)을
    //   board-images 내부 경로로 정규화 후 Supabase Storage 배치 sign API 로 1시간 서명 URL 발급.
    //   실패 시 빈 결과 → 클라이언트는 기존 public URL 로 폴백(버킷 비공개 전 무중단).
    if (tableName === '__sign_board_images__') {
      // 학부모 차단 — 이 분기는 default-deny 게이트(아래)보다 먼저 처리되므로 여기서 명시 차단.
      //   게시판 이미지 서명 URL 발급은 선생님/관리자 기능. 학부모는 경로 문자열만 알면
      //   센터·권한 경계를 넘어 서명 URL 을 받을 수 있어 차단한다.
      if (user.role === 'parent') {
        return new Response(JSON.stringify({ error: '학부모는 해당 기능에 접근할 수 없습니다' }), { status: 403, headers: CORS })
      }
      if (method !== 'POST') {
        return new Response(JSON.stringify({ error: 'POST 필요' }), { status: 405, headers: CORS })
      }
      const inPaths = (body && typeof body === 'object' && Array.isArray((body as Record<string, unknown>).paths))
        ? ((body as Record<string, unknown>).paths as unknown[])
        : []
      const norm = inPaths.slice(0, 100).map(function (p) {
        const s = String(p || '')
        const mm = s.match(/board-images\/([^?]+)/)
        return mm ? mm[1] : s.replace(/^\/+/, '')
      }).filter(function (p) { return p && !p.includes('..') })
      if (norm.length === 0) {
        return new Response(JSON.stringify({ urls: {} }), { status: 200, headers: { ...CORS, 'Content-Type': 'application/json' } })
      }
      try {
        const signRes = await fetch(SUPA_URL + '/storage/v1/object/sign/board-images', {
          method:  'POST',
          headers: { 'Content-Type': 'application/json', 'apikey': SUPA_KEY, 'Authorization': 'Bearer ' + SUPA_KEY },
          body:    JSON.stringify({ expiresIn: 3600, paths: norm }),
        })
        if (!signRes.ok) {
          return new Response(JSON.stringify({ urls: {} }), { status: 200, headers: { ...CORS, 'Content-Type': 'application/json' } })
        }
        const arr  = await signRes.json() as Array<{ path?: string; signedURL?: string }>
        const urls: Record<string, string> = {}
        for (const it of (Array.isArray(arr) ? arr : [])) {
          if (it && it.path && it.signedURL) urls[it.path] = SUPA_URL + '/storage/v1' + it.signedURL
        }
        return new Response(JSON.stringify({ urls: urls }), { status: 200, headers: { ...CORS, 'Content-Type': 'application/json' } })
      } catch (_) {
        return new Response(JSON.stringify({ urls: {} }), { status: 200, headers: { ...CORS, 'Content-Type': 'application/json' } })
      }
    }

    // ★ 클라이언트 감사 이벤트(madi_audit_log) POST 전용 통제 분기.
    //   ALLOWED_TABLES 에 audit_log 를 넣지 않고 여기서 흡수 — POST 만 정제 INSERT 허용,
    //   actor/center 는 JWT 강제, action 화이트리스트. GET(운영자 조회)·기타 method 는 차단.
    //   (이 분기가 없으면 클라 감사쓰기가 403 → .catch(()=>{}) 로 영구 폐기됐음.)
    if (tableName === 'madi_audit_log') {
      if (method !== 'POST') {
        // GET 등 운영자 조회는 이 프록시로는 불허(직접 DB/별도 경로). POST 만 수용.
        return new Response(JSON.stringify({ error: '감사 로그는 기록(POST)만 가능합니다' }), { status: 403, headers: CORS })
      }
      const auditRes = await insertClientAudit(SUPA_URL, SUPA_KEY, user, body)
      // insertClientAudit 의 최소 헤더에 CORS 를 합쳐 반환
      const merged: Record<string, string> = { ...CORS, 'Content-Type': 'application/json' }
      return new Response(auditRes.body, { status: auditRes.status, headers: merged })
    }

    // 허용 테이블 체크
    if (!ALLOWED_TABLES.includes(tableName)) {
      return new Response(JSON.stringify({ error: '접근 불가 테이블: ' + tableName }), { status: 403, headers: CORS })
    }

    // 관리자 전용 테이블 체크
    if (ADMIN_ONLY_TABLES.includes(tableName) && user.role !== 'admin' && user.role !== 'superadmin') {
      return new Response(JSON.stringify({ error: '관리자 권한이 필요합니다' }), { status: 403, headers: CORS })
    }

    // ★ 민감 설정 SELECT 감사 — admin/superadmin 이 madi_settings 를 조회한 흐름을 추적.
    //   API 키 등 민감값이 평문 저장돼 있어 조회만으로도 누가·언제·어떤 키를 봤는지 남긴다.
    //   감사 INSERT 는 service_role 권한이라 사용자 RLS 와 무관, 본 요청 응답은 await 없이 진행.
    if (tableName === 'madi_settings') {
      logSettingsAccess(SUPA_URL, SUPA_KEY, user, req, path, method || 'GET')
    }

    // 관리자만 쓰기 가능 테이블 (GET은 허용)
    if (ADMIN_WRITE_TABLES.includes(tableName) && method && method !== 'GET'
        && user.role !== 'admin' && user.role !== 'superadmin') {
      return new Response(JSON.stringify({ error: '관리자만 수정할 수 있습니다' }), { status: 403, headers: CORS })
    }

    // 슈퍼관리자만 쓰기 가능 테이블 (GET은 허용)
    if (SUPERADMIN_WRITE_TABLES.includes(tableName) && method && method !== 'GET'
        && user.role !== 'superadmin') {
      return new Response(JSON.stringify({ error: '슈퍼관리자만 수정할 수 있습니다' }), { status: 403, headers: CORS })
    }

    // ★ D2: madi_children 하드 삭제는 admin/superadmin 전용 (teacher 차단)
    //   teacher의 아동 종결은 status PATCH(closeChild)이므로 PATCH는 허용, DELETE만 제한.
    if (tableName === 'madi_children' && method === 'DELETE'
        && user.role !== 'admin' && user.role !== 'superadmin') {
      return new Response(JSON.stringify({ error: '아동 삭제는 관리자 이상만 가능합니다' }), { status: 403, headers: CORS })
    }

    // 학부모 쓰기 차단
    if (user.role === 'parent' && PARENT_READONLY_TABLES.includes(tableName) && method && method !== 'GET') {
      return new Response(JSON.stringify({ error: '학부모는 해당 데이터를 수정할 수 없습니다' }), { status: 403, headers: CORS })
    }

    // ★ 학부모 전체 차단 — 세션 기록 등 (선생님 보호 정책)
    if (user.role === 'parent' && PARENT_BLOCKED_TABLES.includes(tableName)) {
      return new Response(JSON.stringify({ error: '학부모는 해당 데이터를 열람할 수 없습니다' }), { status: 403, headers: CORS })
    }

    // ★ [HIGH IDOR 차단] 학부모의 madi_parent_children 직접 쓰기 전면 차단.
    //   READ(본인 연결 조회)는 PARENT_USER_SCOPED 에서 parent_user_id=eq.본인 으로 격리되어 유지.
    //   POST 분기는 parent_user_id 만 본인으로 강제하고 child_id 는 클라 입력 그대로 INSERT 했으므로,
    //   학부모가 임의 child_id 를 보내 타인 아동 임상데이터 전체에 자기연결(IDOR)할 수 있었다.
    //   이 연결은 회원가입(parent-auth, 전화번호 재검증) 또는 관리자/교사 경로(service_role/별도 함수)
    //   로만 생성되어야 하므로, parent 의 이 테이블 write(POST/PATCH/PUT/DELETE)는 항상 403.
    if (user.role === 'parent' && tableName === 'madi_parent_children' && method && method !== 'GET') {
      return new Response(JSON.stringify({ error: '아동 연결은 회원가입 또는 센터를 통해서만 가능합니다' }), { status: 403, headers: CORS })
    }

    // ★ 학부모 default-deny — 허용 화이트리스트 외 전면 차단 (라운지·초대 등 내부 채널 IDOR 방지)
    if (user.role === 'parent' && !PARENT_ALLOWED_TABLES.includes(tableName)) {
      return new Response(JSON.stringify({ error: '학부모는 해당 데이터에 접근할 수 없습니다' }), { status: 403, headers: CORS })
    }

    // ★ 라운지 댓글 센터별 격리 — 댓글엔 center_id 컬럼이 없어 부모 글(post)의 center_id 로 검증.
    //   service_role 프록시는 RLS 를 우회하므로, RLS 의 post-기반 센터 격리를 여기서 복제한다.
    //   GET/POST 는 post_id 의 소속 센터 일치를 강제, PATCH/DELETE 는 author_id 소유권(GLOBAL_OWNER_COL)이
    //   본인 댓글(=본인 센터)로 한정하므로 추가 검증 불필요. superadmin 은 운영 지원 위해 전체 예외.
    if (tableName === 'madi_lounge_comments' && user.role !== 'superadmin'
        && (!method || method === 'GET' || method === 'POST')) {
      let postId: string | null = null
      if (method === 'POST') {
        const row = Array.isArray(body) ? body[0] : body
        if (row && typeof row === 'object') {
          const pv = (row as Record<string, unknown>).post_id
          if (pv !== undefined && pv !== null) postId = String(pv)
        }
      } else {
        const m = path.match(/[?&]post_id=eq\.([^&]+)/)
        if (m) postId = decodeURIComponent(m[1])
      }
      if (!postId) {
        return new Response(JSON.stringify({ error: '댓글은 글(post_id) 범위로만 접근할 수 있습니다' }), { status: 400, headers: CORS })
      }
      const postRes = await fetch(
        SUPA_URL + '/rest/v1/madi_lounge_posts?id=eq.' + encodeURIComponent(postId) + '&select=center_id&limit=1',
        { headers: { 'apikey': SUPA_KEY, 'Authorization': 'Bearer ' + SUPA_KEY } }
      )
      if (!postRes.ok) {
        return new Response(JSON.stringify({ error: '글 검증 실패' }), { status: 500, headers: CORS })
      }
      const postRows = await postRes.json() as Array<{ center_id: unknown }>
      const parentPost = postRows && postRows[0]
      if (!parentPost || String(parentPost.center_id) !== String(user.center_id)) {
        return new Response(JSON.stringify({ error: '다른 센터의 라운지에는 접근할 수 없습니다' }), { status: 403, headers: CORS })
      }
    }

    // ══════════════════════════════════════════════════════════
    // ★ madi_users 추가 보강 — 시니어 보안 진단 후속
    //   1) 비밀번호 해시 컬럼이 응답에 절대 노출되지 않게 select 정제
    //   2) PATCH 로 role/permissions 변경은 superadmin 만, 그 외에는 본인 row 의 이름/색상만
    // ══════════════════════════════════════════════════════════
    // SEC6: totp_secret 도 절대 응답에 노출 금지 (저장된 secret 이 새면 2FA 우회 가능)
    const USER_SENSITIVE_COLS = new Set(['password', 'password_hash', 'pw', 'pwd', 'totp_secret'])
    const USER_SAFE_DEFAULTS  = 'id,username,name,role,center_id,color,permissions,totp_enabled'
    // ★ select 화이트리스트 — 이 집합에 속한 컬럼만 명시 select 가능.
    //   집합 밖 컬럼·별칭(`:`)·`*`·민감컬럼이 하나라도 있으면 전체를 USER_SAFE_DEFAULTS 로 강제.
    const USER_SELECT_WHITELIST = new Set([
      'id', 'username', 'name', 'role', 'center_id', 'color', 'permissions',
      'totp_enabled', 'totp_enrolled_at', 'status', 'password_changed_at',
      'session_revoked_at', 'failed_login_count', 'last_failed_at', 'locked_until',
      'prog_types', 'created_at',
    ])

    if (tableName === 'madi_users') {
      // ── select 파라미터 정제 (화이트리스트 방식) ──
      //   완전일치 제거(blacklist)는 `select=*`·별칭(`pw:password`)·대문자(`Password`) 우회가
      //   가능했음. 이제 요청 컬럼이 USER_SELECT_WHITELIST 에 모두 속할 때만 그대로 통과하고,
      //   `*`·별칭·화이트리스트 밖 토큰이 하나라도 있으면 전체를 USER_SAFE_DEFAULTS 로 치환.
      if (/[?&]select=/.test(path)) {
        path = path.replace(/([?&])select=([^&]*)/g, (_m, sep, cols) => {
          const raw = String(cols)
            .split(',')
            .map((c: string) => c.trim())
            .filter((c: string) => c.length > 0)
          // 토큰을 소문자 기준으로 화이트리스트 검사. `*`·별칭(`:`)·민감컬럼·미허용 컬럼은
          // 전부 거부 사유 → 하나라도 걸리면 안전 기본값으로 강제 치환.
          let safe = raw.length > 0
          for (const tok of raw) {
            const lower = tok.toLowerCase()
            if (tok === '*' || tok.indexOf('*') !== -1) { safe = false; break }
            if (tok.indexOf(':') !== -1) { safe = false; break }        // 별칭 우회 차단
            if (USER_SENSITIVE_COLS.has(lower)) { safe = false; break }
            if (!USER_SELECT_WHITELIST.has(lower)) { safe = false; break }
          }
          return sep + 'select=' + (safe ? raw.join(',') : USER_SAFE_DEFAULTS)
        })
      } else if (!method || method === 'GET') {
        // select 지정 안 한 GET 요청은 안전 기본 컬럼 강제
        path = path + (path.includes('?') ? '&' : '?') + 'select=' + USER_SAFE_DEFAULTS
      }

      // ── PATCH 권한 escalation 방어 ──
      if (method === 'PATCH') {
        // ── teacher IDOR 방어: teacher 는 자신의 row 만 수정 가능 ──
        // admin 은 center_id 필터(PostgREST RLS)로 충분, superadmin 은 제한 없음.
        if (user.role === 'teacher') {
          const idMatch = path.match(/[?&]id=eq\.([^&]+)/)
          if (!idMatch) {
            // id=eq.xxx 필터 없이 bulk PATCH 시도 — teacher 에게 불허
            return new Response(
              JSON.stringify({ error: '자신의 계정(id=eq.xxx)에 한해 수정 가능합니다' }),
              { status: 403, headers: CORS }
            )
          }
          const targetId = decodeURIComponent(idMatch[1])
          if (targetId !== String(user.sub)) {
            return new Response(
              JSON.stringify({ error: '다른 사용자의 계정을 수정할 수 없습니다' }),
              { status: 403, headers: CORS }
            )
          }
        }

        const rows = Array.isArray(body) ? body : [body]
        for (const row of rows) {
          if (!row || typeof row !== 'object') continue
          const obj = row as Record<string, unknown>
          const touchesRole        = 'role' in obj
          const touchesPermissions = 'permissions' in obj

          // role 변경은 superadmin만 허용
          if (touchesRole && user.role !== 'superadmin') {
            return new Response(
              JSON.stringify({ error: 'role 은 슈퍼관리자만 변경할 수 있습니다' }),
              { status: 403, headers: CORS }
            )
          }

          // permissions 변경: superadmin은 무조건 허용,
          // admin은 같은 센터의 teacher 계정에 한해 허용 (자기 센터 권한 관리)
          if (touchesPermissions && user.role !== 'superadmin') {
            if (user.role !== 'admin') {
              return new Response(
                JSON.stringify({ error: 'permissions 는 관리자 이상만 변경할 수 있습니다' }),
                { status: 403, headers: CORS }
              )
            }
            // admin: 대상 user의 center_id·role 검증 (id=eq.xxx 필터가 path에 있어야 함)
            const idMatch = path.match(/[?&]id=eq\.([^&]+)/)
            if (!idMatch) {
              return new Response(
                JSON.stringify({ error: '권한 변경 시 단일 사용자 ID 필터(id=eq.xxx)가 필요합니다' }),
                { status: 400, headers: CORS }
              )
            }
            const targetId = decodeURIComponent(idMatch[1])
            const targetRes = await fetch(
              SUPA_URL + '/rest/v1/madi_users?id=eq.' + encodeURIComponent(targetId)
                + '&select=center_id,role',
              { headers: { 'apikey': SUPA_KEY, 'Authorization': 'Bearer ' + SUPA_KEY } }
            )
            if (!targetRes.ok) {
              return new Response(
                JSON.stringify({ error: '대상 사용자 조회 실패' }),
                { status: 500, headers: CORS }
              )
            }
            const targets = await targetRes.json() as Array<{ center_id: unknown; role: string }>
            const target  = targets && targets[0]
            if (!target) {
              return new Response(
                JSON.stringify({ error: '대상 사용자를 찾을 수 없습니다' }),
                { status: 404, headers: CORS }
              )
            }
            // 같은 센터인지 확인
            if (String(target.center_id) !== String(user.center_id)) {
              return new Response(
                JSON.stringify({ error: '다른 센터의 사용자 권한은 변경할 수 없습니다' }),
                { status: 403, headers: CORS }
              )
            }
            // admin 또는 superadmin 계정의 permissions는 admin이 변경 불가 (권한 상승 방지)
            if (target.role === 'admin' || target.role === 'superadmin') {
              return new Response(
                JSON.stringify({ error: '관리자·슈퍼관리자 계정의 권한은 변경할 수 없습니다' }),
                { status: 403, headers: CORS }
              )
            }
          }

          // 누구든 PATCH 시 password 컬럼은 이 엔드포인트로 변경 불가 (change-password 함수 전용)
          if ('password' in obj || 'password_hash' in obj) {
            return new Response(
              JSON.stringify({ error: '비밀번호는 /change-password 엔드포인트로만 변경 가능합니다' }),
              { status: 403, headers: CORS }
            )
          }
        }
      }

      // ── POST(회원가입) 시 role/permissions 서버 강제 ──
      // 클라이언트가 보낸 role/permissions 값을 무시하고 서버에서 안전값으로 덮어씀.
      // 계정은 항상 teacher 로 시작 — admin/superadmin 승격은 별도 관리자 액션으로만 가능.
      if (method === 'POST') {
        // 클라이언트 DEFAULT_PERMS(madi-core.js)와 키 일치 유지 — 신규 계정 기본 권한(H-2)
        const DEFAULT_PERMISSIONS = { viewOtherChildren: true, editChild: true, deleteSession: true, useAI: true, deleteAssessment: true }
        const rows = Array.isArray(body) ? body : (body ? [body] : [])
        for (const row of rows) {
          if (!row || typeof row !== 'object') continue
          const obj = row as Record<string, unknown>
          // role: 기본 teacher 강제. 단 superadmin 이 명시적으로 admin 계정을 생성하는
          //   경우만 admin 허용(센터장 지정). admin/teacher 요청자는 무엇을 보내든 teacher 로 강등.
          obj.role = (user.role === 'superadmin' && obj.role === 'admin') ? 'admin' : 'teacher'
          // permissions: 허용된 기본값으로 강제 (클라이언트 확장 시도 차단)
          obj.permissions = DEFAULT_PERMISSIONS
          // ※ status 는 운영 DB(madi_users)에 존재하지 않는 컬럼 → 주입 시 PostgREST 42703(400)
          //   으로 직원 추가가 전부 실패함. 계정 활성/비활성 상태가 필요해지면 status 컬럼을
          //   추가(DEFAULT 'active')한 뒤 여기서 위임할 것. 현재는 주입하지 않는다.
        }
      }
    }

    // ★ [PIPA] 아동 등록 시 보호자 동의 증빙 — guardianConsent 캡처 후 INSERT 본문에서 제거.
    //   madi_children 에는 guardianConsent 컬럼이 없어 그대로 forwarding 하면 PostgREST 42703(400)
    //   으로 아동 생성이 깨진다. 반드시 분리(strip)한 뒤 전달하고, 생성 성공 후 audit_log 에 증빙 기록.
    let childGuardianConsent = false
    if (tableName === 'madi_children' && method === 'POST') {
      const _childRows = Array.isArray(body) ? body : (body ? [body] : [])
      for (const row of _childRows) {
        if (row && typeof row === 'object') {
          const obj = row as Record<string, unknown>
          if (obj.guardianConsent === true) childGuardianConsent = true
          delete obj.guardianConsent
        }
      }
    }

    // ★ 작성자 위장 차단 — 라운지/공지 POST 의 author_id·author_name 을 JWT(서버)에서 강제.
    //   클라이언트가 타인 author_id 나 NULL(작성자 추적 우회)을 보내도 무시하고 본인으로 덮어쓴다.
    if (method === 'POST' &&
        (tableName === 'madi_lounge_posts' || tableName === 'madi_lounge_comments'
         || tableName === 'madi_notices' || tableName === 'madi_global_notices')) {
      const authorRows = Array.isArray(body) ? body : (body ? [body] : [])
      for (const row of authorRows) {
        if (row && typeof row === 'object') {
          const obj = row as Record<string, unknown>
          obj.author_id   = String(user.sub)
          obj.author_name = String(user.name || '')
          // author_role 은 NOT NULL 컬럼 — 자료실 등 일부 경로가 누락해 INSERT 400 발생.
          // 작성자 위장 차단 겸 서버에서 JWT role 로 강제(클라 값 무시).
          obj.author_role = String(user.role || '')
        }
      }
    }

    let finalPath = path

    // ══════════════════════════════════════════════════════════
    // ★ 학부모 전용 READ 필터 — child_id 기반 서버 격리 (다자녀 지원)
    // 같은 센터 내 다른 아동 데이터 노출 차단.
    // JWT 의 단일 parent_child_id 에 의존하지 않고, 매 요청 madi_parent_children 에서
    // 이 학부모에게 연결된 '모든' child_id 를 권위 조회해 집합(in)으로 격리한다.
    //   · 다자녀(형제 2명+) 전원의 데이터 접근 가능 (기존엔 첫 자녀만 보여 둘째가 안 나옴)
    //   · 클라이언트가 보낸 id=eq.<활성자녀> 가 이 집합과 AND 되어 자녀 전환이 정상 동작
    //   · 아동 이관·연결 회수도 재로그인 없이 즉시 반영(authoritative)
    // ══════════════════════════════════════════════════════════
    if (user.role === 'parent' && PARENT_READONLY_TABLES.includes(tableName) && (!method || method === 'GET')) {
      const centerId = user.center_id as string

      if (!centerId) {
        return new Response(JSON.stringify({ error: '센터 정보 없음' }), { status: 403, headers: CORS })
      }

      // 서버 권위 목록: 연결된 모든 child_id 재조회
      let childIds: string[] = []
      try {
        const linkRes = await fetch(
          SUPA_URL + '/rest/v1/madi_parent_children'
            + '?parent_user_id=eq.' + encodeURIComponent(String(user.sub))
            + '&select=child_id',
          { headers: { 'apikey': SUPA_KEY, 'Authorization': 'Bearer ' + SUPA_KEY } }
        )
        if (!linkRes.ok) {
          return new Response(JSON.stringify({ error: '권한 검증 실패' }), { status: 500, headers: CORS })
        }
        const linkRows = await linkRes.json() as Array<{ child_id: unknown }>
        if (Array.isArray(linkRows)) {
          childIds = linkRows
            .map(function (r) { return String(r.child_id) })
            .filter(function (c) { return c && c !== 'null' && c !== 'undefined' })
        }
      } catch (_) {
        return new Response(JSON.stringify({ error: '권한 검증 실패' }), { status: 500, headers: CORS })
      }
      if (childIds.length === 0) {
        return new Response(
          JSON.stringify({ error: '연결된 아동 정보가 없습니다. 다시 로그인해주세요.' }),
          { status: 403, headers: CORS }
        )
      }

      // 기본: center_id 필터
      let extraFilter = 'center_id=eq.' + centerId

      // child 격리: 연결된 자녀 '집합'(in) 으로 제한
      const inList = childIds.map(function (c) { return encodeURIComponent(c) }).join(',')
      if (tableName === 'madi_children') {
        extraFilter += '&id=in.(' + inList + ')'
      } else if (PARENT_CHILD_FILTER_TABLES.includes(tableName)) {
        extraFilter += '&data->>childId=in.(' + inList + ')'
      } else if (PARENT_CHILD_COLUMN_TABLES.includes(tableName)) {
        // child_id 가 실 컬럼인 테이블 (madi_portfolios 등)
        extraFilter += '&child_id=in.(' + inList + ')'
      }

      // ★ parent_visible 가시성 강제 — 선생님이 OPEN 한 row 만 노출
      if (PARENT_VISIBLE_GATED_TABLES.includes(tableName)) {
        extraFilter += '&parent_visible=eq.true'
      }

      finalPath = path + (path.includes('?') ? '&' : '?') + extraFilter

    // ══════════════════════════════════════════════════════════
    // 학부모 user_id 스코프 테이블 (알림, 학부모-아동 연결)
    // ══════════════════════════════════════════════════════════
    } else if (user.role === 'parent' && PARENT_USER_SCOPED[tableName] !== undefined) {
      const col    = PARENT_USER_SCOPED[tableName]
      const userId = user.sub as string
      if (!method || method === 'GET') {
        finalPath = path + (path.includes('?') ? '&' : '?') + col + '=eq.' + userId
      } else if (method === 'POST') {
        const _pRows = Array.isArray(body) ? body : (body ? [body] : [])
        if (tableName === 'madi_parent_observations') {
          // 관찰기록 위변조 차단: parent_user_id 강제 외에 child_id 가 '이 학부모와 연결된'
          //   아동인지 권위 조회로 검증하고, center_id 를 연결 행 기준으로 서버 치환.
          //   (기존엔 child_id·center_id 를 클라 값 그대로 신뢰 → 미연결 아동/타 센터 주입 가능)
          const _linkRes = await fetch(
            SUPA_URL + '/rest/v1/madi_parent_children?parent_user_id=eq.' + encodeURIComponent(userId) + '&select=child_id,center_id',
            { headers: { 'apikey': SUPA_KEY, 'Authorization': 'Bearer ' + SUPA_KEY } }
          )
          if (!_linkRes.ok) {
            return new Response(JSON.stringify({ error: '아동 연결 확인에 실패했습니다' }), { status: 403, headers: CORS })
          }
          const _links = await _linkRes.json() as Array<{ child_id: unknown; center_id: unknown }>
          const _childCenter: Record<string, string> = {}
          for (const l of _links) _childCenter[String(l.child_id)] = String(l.center_id)
          for (const row of _pRows) {
            if (!row || typeof row !== 'object') continue
            const r = row as Record<string, unknown>
            r[col] = userId
            const _cid = String(r.child_id ?? '')
            if (!_childCenter[_cid]) {
              return new Response(JSON.stringify({ error: '연결되지 않은 아동입니다' }), { status: 403, headers: CORS })
            }
            r.center_id = _childCenter[_cid]
          }
        } else {
          for (const row of _pRows) {
            if (row && typeof row === 'object') (row as Record<string, unknown>)[col] = userId
          }
        }
      } else if (method === 'PATCH' || method === 'DELETE') {
        finalPath = path + (path.includes('?') ? '&' : '?') + col + '=eq.' + userId
      }

    // ══════════════════════════════════════════════════════════
    // ★ admin 롤: center_id 강제치환 (타센터 데이터 접근 방지)
    //   superadmin은 전체 접근 허용 (운영 모니터링 용도)
    // ══════════════════════════════════════════════════════════
    } else if (user.role === 'admin' && !GLOBAL_TABLES.includes(tableName)) {
      const centerId = user.center_id as string
      if (!centerId) {
        return new Response(JSON.stringify({ error: '센터 정보 없음' }), { status: 403, headers: CORS })
      }

      if (tableName === 'madi_centers') {
        // madi_centers는 center_id 컬럼이 없고 id가 PK — id 기준 강제
        if (!method || method === 'GET') {
          finalPath = path + (path.includes('?') ? '&' : '?') + 'id=eq.' + centerId
        } else if (method === 'PATCH' || method === 'DELETE') {
          finalPath = 'madi_centers?id=eq.' + centerId
        }
      } else {
        // 나머지 모든 테이블: center_id 강제치환
        if (!method || method === 'GET') {
          finalPath = path + (path.includes('?') ? '&' : '?') + 'center_id=eq.' + centerId
        } else if (method === 'POST') {
          if (Array.isArray(body)) {
            for (const row of body) {
              if (row && typeof row === 'object') (row as Record<string, unknown>).center_id = centerId
            }
          } else if (body && typeof body === 'object') {
            (body as Record<string, unknown>).center_id = centerId
          }
        } else if (method === 'PATCH' || method === 'DELETE') {
          finalPath = path + (path.includes('?') ? '&' : '?') + 'center_id=eq.' + centerId
        }
      }

    // ══════════════════════════════════════════════════════════
    // 일반 center_id 스코프 (치료사 등 비관리자)
    // ══════════════════════════════════════════════════════════
    //
    // ※ [MED 보안 — 서버 강제 불가] 권한 'viewOtherChildren'("다른 선생님 아동 조회")는
    //   여기서 서버 강제할 수 없다. madi_children 에는 담당교사 소유 컬럼이 존재하지 않으며
    //   (SCHEMA.md: id, center_id, data JSONB 뿐), 담당관계는 클라이언트 isMyChild(madi-core.js)
    //   가 sessionDB/scheduleDB 의 data.teacher === currentUser.name 매칭으로 런타임 추론한다.
    //   따라서 이 필터는 **UI 편의 필터(보안 경계 아님)**이며, 같은 센터 교사는 직접 API 호출 시
    //   센터 내 모든 아동을 조회할 수 있다(센터 격리만 서버 보장). 서버 강제하려면 madi_children
    //   에 담당교사 컬럼(예: assigned_teacher_id)을 신설하고 여기에 필터를 추가해야 한다(스키마 부재로 보류).
    } else if (user.role !== 'admin' && user.role !== 'superadmin' && !GLOBAL_TABLES.includes(tableName)) {
      const centerId = user.center_id as string
      if (!centerId) {
        return new Response(JSON.stringify({ error: '센터 정보 없음' }), { status: 403, headers: CORS })
      }
      if (!method || method === 'GET') {
        finalPath = path + (path.includes('?') ? '&' : '?') + 'center_id=eq.' + centerId
      } else if (method === 'POST') {
        if (Array.isArray(body)) {
          for (const row of body) {
            if (row && typeof row === 'object') (row as Record<string, unknown>).center_id = centerId
          }
        } else if (body && typeof body === 'object') {
          (body as Record<string, unknown>).center_id = centerId
        }
      } else if (method === 'PATCH' || method === 'DELETE') {
        finalPath = path + (path.includes('?') ? '&' : '?') + 'center_id=eq.' + centerId
      }
    }

    // ══════════════════════════════════════════════════════════
    // ★ madi_lounge_posts 가시성(visibility) 서버 강제 — 클라 filterLoungePosts(madi-board.js) 복제.
    //   service_role 프록시는 RLS 를 우회하므로 가시성 필터가 없으면, 같은 센터의 타 직원 1:1
    //   비공개 글(private_admin/private_super)을 콘솔 직접 호출로 평문 열람할 수 있다.
    //   teacher/admin 은 위 스코프에서 center_id 필터가 이미 적용됨 → 여기선 visibility 만 AND 로 좁힌다.
    // ══════════════════════════════════════════════════════════
    if (tableName === 'madi_lounge_posts' && (!method || method === 'GET')) {
      const _luid = String(user.sub)
      let _visFilter: string
      if (user.role === 'superadmin') {
        // 전 센터 공개글 + 모든 private_super 1:1
        _visFilter = 'or=(visibility.eq.center,visibility.eq.private_super)'
      } else if (user.role === 'admin') {
        // 자기 센터 공개글 + private_admin + 본인 발신 private_super
        _visFilter = 'or=(visibility.eq.center,visibility.eq.private_admin,and(visibility.eq.private_super,author_id.eq.' + _luid + '))'
      } else {
        // teacher: 공개글 + 본인 발신 비공개
        _visFilter = 'or=(visibility.eq.center,author_id.eq.' + _luid + ')'
      }
      finalPath = finalPath + (finalPath.includes('?') ? '&' : '?') + _visFilter
    }

    // ══════════════════════════════════════════════════════════
    // ★ GLOBAL_TABLES PATCH/DELETE 소유권 검증 (IDOR 방지)
    //   center_id 격리 없는 전역 테이블은 본인 row 만 수정·삭제 가능
    //   superadmin/admin은 예외 (madi_lounge_posts 만 admin 예외)
    // ══════════════════════════════════════════════════════════
    const GLOBAL_OWNER_COL: Record<string, string> = {
      'madi_lounge_comments':   'author_id',
      'madi_push_subscriptions': 'user_id',
      'madi_lounge_posts':      'author_id',
    }

    if (GLOBAL_TABLES.includes(tableName) && (method === 'PATCH' || method === 'DELETE')) {
      const ownerCol = GLOBAL_OWNER_COL[tableName]
      if (ownerCol) {
        const isSuperOrAdmin = user.role === 'superadmin' || user.role === 'admin'
        // madi_lounge_posts: superadmin/admin 은 삭제·수정 허용 (공지 관리 목적)
        // madi_lounge_comments, madi_push_subscriptions: superadmin 만 예외
        const canSkipOwner = tableName === 'madi_lounge_posts'
          ? isSuperOrAdmin
          : user.role === 'superadmin'
        if (!canSkipOwner) {
          finalPath = finalPath + (finalPath.includes('?') ? '&' : '?')
            + ownerCol + '=eq.' + encodeURIComponent(String(user.sub))
        }
      }
    }

    // ★ push_subscriptions GET 도 본인 소유만 — 전체 구독(endpoint·p256dh·auth) 유출(IDOR) 차단
    //   PATCH/DELETE 는 위 GLOBAL_OWNER_COL 블록에서 이미 소유권 강제. GET 은 어느 분기에도
    //   걸리지 않아(GLOBAL_TABLES → center 스코프 스킵) 무필터로 전 사용자 키가 노출됐었음.
    //   superadmin 은 운영 모니터링 위해 예외(기존 소유권 정책과 동일).
    if (tableName === 'madi_push_subscriptions' && (!method || method === 'GET')
        && user.role !== 'superadmin') {
      finalPath = finalPath + (finalPath.includes('?') ? '&' : '?')
        + 'user_id=eq.' + encodeURIComponent(String(user.sub))
    }

    // ★ madi_notifications GET 도 본인 수신분만 — push_subscriptions 와 동일한 IDOR 차단.
    //   teacher 는 위 center_id 스코프(654-671)만 걸려, 직접 API 호출 시 자기 센터의 '모든'
    //   학부모 대상 알림(세션 요약·점수 본문 포함)을 열람할 수 있었다. parent 는 PARENT_USER_SCOPED
    //   에서 이미 user_id 강제. admin/superadmin 은 센터 운영 모니터링을 위해 예외.
    if (tableName === 'madi_notifications' && (!method || method === 'GET')
        && user.role !== 'superadmin' && user.role !== 'admin') {
      finalPath = finalPath + (finalPath.includes('?') ? '&' : '?')
        + 'user_id=eq.' + encodeURIComponent(String(user.sub))
    }

    // ══════════════════════════════════════════════════════════
    // ★ superadmin POST: center_id 주입
    //   GET은 전체 조회 유지, POST만 자신의 center_id로 귀속
    //   → madi_settings api_key 등 센터 스코프 데이터가 NULL center_id로 저장되는 버그 방지
    // ══════════════════════════════════════════════════════════
    if (user.role === 'superadmin' && !GLOBAL_TABLES.includes(tableName) && method === 'POST') {
      const centerId = user.center_id as string
      if (centerId) {
        if (Array.isArray(body)) {
          for (const row of body) {
            if (row && typeof row === 'object' && !(row as Record<string, unknown>).center_id) {
              (row as Record<string, unknown>).center_id = centerId
            }
          }
        } else if (body && typeof body === 'object' && !(body as Record<string, unknown>).center_id) {
          (body as Record<string, unknown>).center_id = centerId
        }
      }
    }

    // ════════════════════════════════════════════════════════
    // ★ madi_users POST — SHA-256 hex를 그대로 저장
    //   login Edge Function의 lazy-migration이 첫 로그인 시 bcrypt(plain)으로 올바르게 업그레이드함
    //   여기서 bcrypt(sha256) 로 변환하면 login의 bcrypt.compare(plain, hash) 가 실패함

    const url = SUPA_URL + '/rest/v1/' + finalPath
    const fetchHeaders: Record<string, string> = {
      'Content-Type':  'application/json',
      'apikey':        SUPA_KEY,
      'Authorization': 'Bearer ' + SUPA_KEY,
    }
    // ★ 감사 로그 actor 전달 — service_role 컨텍스트에선 트리거의 auth.uid() 가 NULL 이라
    //   누가 변경했는지 기록이 안 됨. JWT 의 실제 행위자를 PostgREST request.headers 로 전달해
    //   madi_log_audit 트리거가 actor_id/actor_role 을 채우도록 한다(쓰기 작업에만).
    if (method && method !== 'GET') {
      if (user.sub  !== undefined && user.sub  !== null) fetchHeaders['x-madi-actor-id']   = String(user.sub)
      if (user.role !== undefined && user.role !== null) fetchHeaders['x-madi-actor-role'] = String(user.role)
    }
    // ★ merge-duplicates 는 UPSERT_TABLES 화이트리스트에만 부여 (임의 PK 덮어쓰기 IDOR 방지).
    //   그 외 POST 는 일반 insert — 충돌 시 PostgREST 가 409 로 거부(타 row 무단 갱신 차단).
    if (method === 'POST') {
      fetchHeaders['Prefer'] = UPSERT_TABLES.includes(tableName)
        ? 'return=representation,resolution=merge-duplicates'
        : 'return=representation'
    }
    if (method === 'PATCH')  fetchHeaders['Prefer'] = 'return=representation'
    if (method === 'DELETE') fetchHeaders['Prefer'] = 'return=representation'

    const response = await fetch(url, {
      method:  method || 'GET',
      headers: fetchHeaders,
      body:    body !== undefined && body !== null ? JSON.stringify(body) : undefined,
    })

    // null body status (204/205/304) 는 RFC 상 body 를 가질 수 없음
    // → JSON.stringify 결과를 넣으면 Deno 가 throw → 빈 응답으로 forward
    const isNullBodyStatus = response.status === 204 || response.status === 205 || response.status === 304
    if (isNullBodyStatus) {
      return new Response(null, { status: response.status, headers: CORS })
    }

    const ct   = response.headers.get('content-type') || ''
    const data = ct.includes('json') ? await response.json() : await response.text()

    // PostgREST 에러 원문(hint/detail/message 등 내부 구조) 노출 방지
    // 2xx가 아닌 응답은 generic 메시지로 래핑해서 내려줌
    if (response.status >= 400) {
      // 원문은 클라엔 노출하지 않되(내부 구조 보호), 서버 로그엔 남겨 원인 추적이 막히지 않게 한다.
      //   (이 로깅 부재로 madi_users.status 42703 진단이 지연된 사례가 있어 추가)
      console.error('[api] upstream error', response.status, method || 'GET', tableName,
        (typeof data === 'string' ? data : JSON.stringify(data)).slice(0, 400))
      return new Response(
        JSON.stringify({ error: '요청을 처리할 수 없습니다', code: response.status }),
        { status: response.status, headers: { ...CORS, 'Content-Type': 'application/json' } }
      )
    }

    // ── [PIPA] 동의 증빙 기록 (성공 경로에서만, best-effort) ──────────────
    //   ① 치료사 가입(madi_users POST + consent 페이로드): action='consent_signup'
    //   ② 아동 등록(madi_children POST + guardianConsent:true): action='consent_child'
    //   data(return=representation) 에서 신규 row id 를 추출해 증빙에 박는다.
    //   logConsentAudit 는 try/catch 내장 best-effort — 실패해도 가입/생성 응답엔 영향 없음.
    function _firstRowId(d: unknown): unknown {
      if (Array.isArray(d) && d.length > 0 && d[0] && typeof d[0] === 'object') {
        return (d[0] as Record<string, unknown>).id
      }
      if (d && typeof d === 'object') return (d as Record<string, unknown>).id
      return null
    }
    if (method === 'POST' && tableName === 'madi_users' && consent) {
      const newUserId = _firstRowId(data) ?? user.sub
      const ver = consent.version != null ? String(consent.version).slice(0, 64) : 'unknown'
      const sens = consent.sensitive === true
      // version·민감동의 여부를 row_id 에 packing (스키마 변경 없이 기존 컬럼만 사용)
      logConsentAudit(SUPA_URL, SUPA_KEY, {
        action:    'consent_signup',
        actorId:   newUserId,
        actorRole: 'teacher',
        rowId:     'v' + ver + '|sensitive:' + sens + '|agreed:' + (consent.agreed === true),
        centerId:  user.center_id,
      })
    }
    if (method === 'POST' && tableName === 'madi_children' && childGuardianConsent) {
      const newChildId = _firstRowId(data)
      logConsentAudit(SUPA_URL, SUPA_KEY, {
        action:    'consent_child',
        actorId:   user.sub,
        actorRole: user.role,
        rowId:     'guardianConsent:true',
        centerId:  user.center_id,
        childId:   newChildId,
      })
    }

    return new Response(
      JSON.stringify(data),
      { status: response.status, headers: { ...CORS, 'Content-Type': 'application/json' } }
    )

  } catch (e) {
    // 내부 메시지·스택은 서버 로그에만 남기고 클라이언트엔 generic 응답
    console.error('[api] unhandled error:', (e as Error).message, (e as Error).stack)
    return new Response(
      JSON.stringify({ error: '서버 오류가 발생했습니다. 잠시 후 다시 시도해주세요.' }),
      { status: 500, headers: CORS }
    )
  }
})
