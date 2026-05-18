// 허용 Origin 목록 — 프로덕션 도메인 + 로컬 개발
const ALLOWED_ORIGINS = new Set([
  'https://namga1541-prog.github.io', // GitHub Pages 프로덕션
  'http://localhost:3000',
  'http://127.0.0.1:3000',
  // file:// → Origin: null (로컬 파일 실행 배포용)
  'null',
])

function makeCORS(origin: string | null): Record<string, string> {
  const o = origin ?? 'null'
  const acao = ALLOWED_ORIGINS.has(o) ? o : 'https://namga1541-prog.github.io'
  return {
    'Access-Control-Allow-Origin':  acao,
    'Access-Control-Allow-Headers': 'authorization, content-type, x-client-info, apikey',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Vary': 'Origin',
  }
}

async function verifyJwt(token: string, secret: string) {
  const [header, body, sig] = token.split('.')
  if (!header || !body || !sig) throw new Error('JWT 형식 오류')
  const key = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['verify']
  )
  const b64  = sig.replace(/-/g, '+'). replace(/_/g, '/')
  const raw  = atob(b64)
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

const ALLOWED_TABLES = [
  'madi_users', 'madi_centers', 'madi_children', 'madi_sessions',
  'madi_schedules', 'madi_assessments', 'madi_activities',
  'madi_iep_history', 'madi_notices', 'madi_settings', 'madi_programs',
  'madi_global_notices', 'madi_lounge_posts', 'madi_lounge_comments', 'madi_parent_invites',
  'madi_parent_children', 'madi_push_subscriptions', 'madi_licenses', 'madi_error_logs', 'madi_notifications'
]

// 관리자 이상만 모든 조작 가능
const ADMIN_ONLY_TABLES = [
  'madi_users', 'madi_centers', 'madi_settings', 'madi_error_logs', 'madi_licenses',
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
  'madi_global_notices', 'madi_lounge_comments', 'madi_push_subscriptions'
]

// 학부모 쓰기 금지 테이블 — 임상 데이터 위변조 방지
const PARENT_READONLY_TABLES = [
  'madi_children', 'madi_sessions', 'madi_schedules',
  'madi_assessments', 'madi_activities', 'madi_iep_history',
  'madi_programs', 'madi_notices'
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

Deno.serve(async (req: Request) => {
  const CORS = makeCORS(req.headers.get('origin'))
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })

  const JWT_SECRET = Deno.env.get('MADI_JWT_SECRET')
  const SUPA_URL   = Deno.env.get('SUPABASE_URL')
  const SUPA_KEY   = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

  if (!JWT_SECRET || !SUPA_URL || !SUPA_KEY) {
    return new Response(JSON.stringify({ error: '서버 설정 오류' }), { status: 500, headers: CORS })
  }

  const auth  = req.headers.get('Authorization') || ''
  const token = auth.replace('Bearer ', '')
  let user: Record<string, unknown>

  try {
    user = await verifyJwt(token, JWT_SECRET)
  } catch {
    return new Response(JSON.stringify({ error: '인증이 필요합니다. 다시 로그인해주세요.' }), { status: 401, headers: CORS })
  }

  try {
    const reqBody = await req.json() as { path: string; method?: string; body?: unknown }
    const { path, method, body } = reqBody
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

    let finalPath = path

    // ══════════════════════════════════════════════════════════
    // ★ 학부모 전용 READ 필터 — child_id 기반 서버 격리
    // 같은 센터 내 다른 아동 데이터 노출 차단
    // ══════════════════════════════════════════════════════════
    if (user.role === 'parent' && PARENT_READONLY_TABLES.includes(tableName) && (!method || method === 'GET')) {
      const centerId      = user.center_id as string
      const parentChildId = user.parent_child_id as string | undefined

      if (!centerId) {
        return new Response(JSON.stringify({ error: '센터 정보 없음' }), { status: 403, headers: CORS })
      }

      // 기본: center_id 필터
      let extraFilter = 'center_id=eq.' + centerId

      if (parentChildId) {
        if (tableName === 'madi_children') {
          extraFilter += '&id=eq.' + parentChildId
        } else if (PARENT_CHILD_FILTER_TABLES.includes(tableName)) {
          extraFilter += '&data->>childId=eq.' + parentChildId
        }
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

    const url = SUPA_URL + '/rest/v1/' + finalPath
    const fetchHeaders: Record<string, string> = {
      'Content-Type':  'application/json',
      'apikey':        SUPA_KEY,
      'Authorization': 'Bearer ' + SUPA_KEY,
    }
    if (method === 'POST')   fetchHeaders['Prefer'] = 'return=representation,resolution=merge-duplicates'
    if (method === 'DELETE') fetchHeaders['Prefer'] = 'return=representation'

    const response = await fetch(url, {
      method:  method || 'GET',
      headers: fetchHeaders,
      body:    body !== undefined && body !== null ? JSON.stringify(body) : undefined,
    })

    const ct   = response.headers.get('content-type') || ''
    const data = ct.includes('json') ? await response.json() : await response.text()

    return new Response(
      JSON.stringify(data),
      { status: response.status, headers: { ...CORS, 'Content-Type': 'application/json' } }
    )

  } catch (e) {
    return new Response(
      JSON.stringify({ error: '서버 오류: ' + (e as Error).message }),
      { status: 500, headers: CORS }
    )
  }
})
