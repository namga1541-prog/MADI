import { makeCORS as makeBaseCORS, getAuthToken, verifyJwt } from '../_shared/auth.ts'

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
  'madi_portfolios'
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

// 학부모 user_id 스코프 테이블
const PARENT_USER_SCOPED: Record<string, string> = {
  'madi_parent_children': 'parent_user_id',
  'madi_notifications':   'user_id',
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

  // ── 세션 무효화 검증 ──
  // 비밀번호 변경 후 발급된 토큰만 유효. 토큰의 iat 가 password_changed_at 보다 이전이면 거부.
  try {
    const tokenIat = Number(user.iat || 0)
    if (tokenIat > 0) {
      const pwdRes = await fetch(
        SUPA_URL + '/rest/v1/madi_users?id=eq.' + encodeURIComponent(String(user.sub)) + '&select=password_changed_at',
        { headers: { 'apikey': SUPA_KEY, 'Authorization': 'Bearer ' + SUPA_KEY } }
      )
      if (pwdRes.ok) {
        const r = await pwdRes.json() as Array<{ password_changed_at?: string }>
        const pwAtStr = r && r[0] ? r[0].password_changed_at : null
        if (pwAtStr) {
          const pwAt = Math.floor(new Date(pwAtStr).getTime() / 1000)
          // 1초 여유 — 동일 초 발급된 토큰은 유효 (clock skew 보정)
          if (tokenIat + 1 < pwAt) {
            return new Response(
              JSON.stringify({ error: '비밀번호가 변경되어 세션이 만료되었습니다. 다시 로그인해주세요.' }),
              { status: 401, headers: CORS }
            )
          }
        }
      }
    }
  } catch (_) {
    // 검증 실패는 무시 (DB 일시 오류 시 사용자 차단 X — 다른 보안 계층이 막음)
  }

  try {
    const reqBody = await req.json() as { path: string; method?: string; body?: unknown }
    const { method, body } = reqBody
    let   path             = reqBody.path   // 정제·재작성 가능하도록 let
    const tableName = path.split('?')[0].split('&')[0]

    // 허용 테이블 체크
    if (!ALLOWED_TABLES.includes(tableName)) {
      return new Response(JSON.stringify({ error: '접근 불가 테이블: ' + tableName }), { status: 403, headers: CORS })
    }

    // 관리자 전용 테이블 체크
    if (ADMIN_ONLY_TABLES.includes(tableName) && user.role !== 'admin' && user.role !== 'superadmin') {
      return new Response(JSON.stringify({ error: '관리자 권한이 필요합니다' }), { status: 403, headers: CORS })
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

    // 학부모 쓰기 차단
    if (user.role === 'parent' && PARENT_READONLY_TABLES.includes(tableName) && method && method !== 'GET') {
      return new Response(JSON.stringify({ error: '학부모는 해당 데이터를 수정할 수 없습니다' }), { status: 403, headers: CORS })
    }

    // ★ 학부모 전체 차단 — 세션 기록 등 (선생님 보호 정책)
    if (user.role === 'parent' && PARENT_BLOCKED_TABLES.includes(tableName)) {
      return new Response(JSON.stringify({ error: '학부모는 해당 데이터를 열람할 수 없습니다' }), { status: 403, headers: CORS })
    }

    // ══════════════════════════════════════════════════════════
    // ★ madi_users 추가 보강 — 시니어 보안 진단 후속
    //   1) 비밀번호 해시 컬럼이 응답에 절대 노출되지 않게 select 정제
    //   2) PATCH 로 role/permissions 변경은 superadmin 만, 그 외에는 본인 row 의 이름/색상만
    // ══════════════════════════════════════════════════════════
    const USER_SENSITIVE_COLS = new Set(['password', 'password_hash', 'pw', 'pwd'])
    const USER_SAFE_DEFAULTS  = 'id,username,name,role,center_id,color,permissions'

    if (tableName === 'madi_users') {
      // ── select 파라미터 정제 ──
      if (/[?&]select=/.test(path)) {
        path = path.replace(/([?&])select=([^&]*)/g, (_m, sep, cols) => {
          const cleaned = String(cols)
            .split(',')
            .map((c: string) => c.trim())
            .filter((c: string) => c && !USER_SENSITIVE_COLS.has(c.toLowerCase()))
            .join(',')
          return sep + 'select=' + (cleaned || USER_SAFE_DEFAULTS)
        })
      } else if (!method || method === 'GET') {
        // select 지정 안 한 GET 요청은 안전 기본 컬럼 강제
        path = path + (path.includes('?') ? '&' : '?') + 'select=' + USER_SAFE_DEFAULTS
      }

      // ── PATCH 권한 escalation 방어 ──
      if (method === 'PATCH') {
        const rows = Array.isArray(body) ? body : [body]
        for (const row of rows) {
          if (!row || typeof row !== 'object') continue
          const obj = row as Record<string, unknown>
          const touchesRole = ('role' in obj) || ('permissions' in obj)
          if (touchesRole && user.role !== 'superadmin') {
            return new Response(
              JSON.stringify({ error: 'role/permissions 는 슈퍼관리자만 변경할 수 있습니다' }),
              { status: 403, headers: CORS }
            )
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
    }

    let finalPath = path

    // ══════════════════════════════════════════════════════════
    // ★ 학부모 전용 READ 필터 — child_id 기반 서버 격리
    // 같은 센터 내 다른 아동 데이터 노출 차단
    // JWT claim 의 parent_child_id 는 서명되어 있어 위조 불가하지만,
    // 토큰 발급 이후 연결이 끊긴 경우(아동 이관·학부모 권한 회수)를 대비해
    // 매 요청 madi_parent_children 매핑을 재검증한다.
    // ══════════════════════════════════════════════════════════
    if (user.role === 'parent' && PARENT_READONLY_TABLES.includes(tableName) && (!method || method === 'GET')) {
      const centerId      = user.center_id as string
      const parentChildId = user.parent_child_id as string | undefined

      if (!centerId) {
        return new Response(JSON.stringify({ error: '센터 정보 없음' }), { status: 403, headers: CORS })
      }

      // 서버측 재검증: (parent_user_id, child_id) 쌍이 실제 존재해야 함
      if (parentChildId) {
        try {
          const linkRes = await fetch(
            SUPA_URL + '/rest/v1/madi_parent_children'
              + '?parent_user_id=eq.' + encodeURIComponent(String(user.sub))
              + '&child_id=eq.'       + encodeURIComponent(String(parentChildId))
              + '&select=child_id&limit=1',
            { headers: { 'apikey': SUPA_KEY, 'Authorization': 'Bearer ' + SUPA_KEY } }
          )
          if (!linkRes.ok) {
            return new Response(JSON.stringify({ error: '권한 검증 실패' }), { status: 500, headers: CORS })
          }
          const linkRows = await linkRes.json() as Array<{ child_id: string }>
          if (!Array.isArray(linkRows) || linkRows.length === 0) {
            return new Response(
              JSON.stringify({ error: '연결된 아동 정보가 없습니다. 다시 로그인해주세요.' }),
              { status: 403, headers: CORS }
            )
          }
        } catch (_) {
          return new Response(JSON.stringify({ error: '권한 검증 실패' }), { status: 500, headers: CORS })
        }
      }

      // 기본: center_id 필터
      let extraFilter = 'center_id=eq.' + centerId

      if (parentChildId) {
        if (tableName === 'madi_children') {
          extraFilter += '&id=eq.' + parentChildId
        } else if (PARENT_CHILD_FILTER_TABLES.includes(tableName)) {
          extraFilter += '&data->>childId=eq.' + parentChildId
        } else if (PARENT_CHILD_COLUMN_TABLES.includes(tableName)) {
          // child_id 가 실 컬럼인 테이블 (madi_portfolios 등)
          extraFilter += '&child_id=eq.' + parentChildId
        }
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
        if (Array.isArray(body)) {
          for (const row of body) {
            if (row && typeof row === 'object') (row as Record<string, unknown>)[col] = userId
          }
        } else if (body && typeof body === 'object') {
          (body as Record<string, unknown>)[col] = userId
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
    if (method === 'POST')   fetchHeaders['Prefer'] = 'return=representation,resolution=merge-duplicates'
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
