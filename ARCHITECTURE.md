# MADI 아키텍처 불변 사실 (Claude·에이전트 필독)

> 매 세션·매 에이전트가 **재조사하지 말아야 할 핵심 사실**만 모은 치트시트.
> 코드 수정·감사 전에 먼저 읽으면 오탐과 헛조사를 막는다. (변하면 즉시 갱신)
> 위치 인덱스는 [FUNCTIONS.md](./FUNCTIONS.md), DB 스키마는 [SCHEMA.md](./SCHEMA.md).

## ID 규칙
- **모든 ID는 문자열**(childId, user id, center_id, session/schedule id). `generateClientId()`·`safeMap` 이 String 으로 정규화.
- `parseInt(select.value)` / `Number(dataset.id)` 로 ID 를 숫자화하거나 숫자 비교하면 **매칭이 항상 깨지는 회귀 버그**. 비교는 `String(a) === String(b)`.
- 단, 나이·점수·금액·회차·개월수는 진짜 숫자 → parseInt 정상.

## 날짜·시간대 (KST)
- `toKST(d) = new Date(d.getTime() + d.getTimezoneOffset()*60000 + 9h)` — **getTimezoneOffset 을 보정**하므로 **KST 기기에선 `new Date()` == `nowKST()`**. (madi-core.js:33)
- 따라서 "`new Date()` → `nowKST()` 로 바꿔라" 류 지적은 **KST 기기에선 대부분 무의미한 오탐**. 실제 버그는 아래 둘뿐:
  - `toISOString().slice(0,10)` 을 **오늘 날짜**로 쓰면 UTC라 KST 새벽에 하루 어긋남 → `ymd(nowKST())` 사용.
  - 날짜 문자열을 `new Date('YYYY-MM-DD')` 로 파싱 시 UTC 자정 → 표시·차이계산에 `+'T00:00:00'` 붙여 로컬 파싱(`parseBirth` 패턴).
- 유틸: `ymd(d)`, `getTodayKST()`, `getMonthKST()`, `fmtDateKR()` (madi-core.js), `parseBirth()`/`calcAgeFromBirth()` (madi-schedule.js).

## 저장 흐름 (데이터 유실 아님)
- `saveSessions()`/`saveChildren()`/`saveSchedule()`/`saveAssess()` (madi-app.js): **먼저 localStorage(`cn3_*`)에 미러** → 그 다음 서버 배치 upsert(50개씩, `?on_conflict=id`).
- 이들은 **`Promise<boolean>` 반환** (true=성공). 호출부는 `.then(ok)` 으로 **성공 시에만 ✅** 표시(거짓 성공 방지). 실패 시 ❌ 는 save 함수 내부에서 표시.
- 오프라인 POST/PATCH/DELETE 는 `supaFetch` 가 큐잉 후 `{_queued:true}` 즉시 resolve → 연결 회복 시 `_oqFlush` 가 전송. **데이터는 로컬+큐에 보존**.

## supaFetch (madi-core.js)
- 모든 DB 접근 경유. HTTP 오류 시 **throw** → 호출부 `.catch` 로 전파.
- 401 → `clearToken()` + 로그인 화면 이동(세션 만료 처리 내장).
- 토큰은 **인메모리 + sessionStorage** (localStorage 저장 금지). URL·로그 노출 없음.

## 보안 모델 (서버가 진짜 경계 — 클라 필터는 보조)
- Edge Function **`api` 프록시(supabase/functions/api/index.ts)가 service_role 로 PostgREST 호출 → RLS 우회**. 따라서 **프록시 자체가 모든 격리를 강제**:
  - **모든 비-superadmin 역할(admin·teacher 포함)에 `center_id=eq.<본인센터>` 강제 주입** (GET/POST/PATCH/DELETE). → 클라 쿼리에 center_id 없어도 **타 센터 침범 불가**.
  - 학부모: center_id + 본인 자녀 child_id(in) + `parent_visible=true` 강제, 쓰기 차단 테이블 화이트리스트.
  - 전역 테이블(center_id 없음): `author_id`/`user_id` 소유자 검증(IDOR 방지).
  - `requireFreshSession()` (_shared/auth.ts): 토큰 iat 가 `session_revoked_at`/`password_changed_at` 보다 과거면 거부 → **강제 로그아웃·비번변경 즉시 무효화**.
- **결론**: "클라에 center_id 필터 없음 / 세션 무효화 안 함" 류 지적은 **서버를 안 본 오탐**일 가능성 큼. RLS 백업본은 `parent_isolation_rls.sql` 등 `*.sql`.

## 전역 변수 정의 위치
- `childDB, sessionDB, scheduleDB, assessmentDB, activityDB, iepDB` — madi-app.js:134
- `currentUser` — madi-core.js:274 / `_madiToken` — madi-core.js:110
- `noticeDB` — madi-home.js:728 / `_madiApiKey` — madi-home.js:2

## PWA·배포
- `sw.js`: 앱 JS/CSS는 **network-first**(항상 최신), 이미지·아이콘은 SWR. `controllerchange` → 자동 reload(설치형 PWA 자동 갱신, index·admin 모두).
- pre-commit(.githooks): CACHE_NAME 갱신 + FUNCTIONS.md 재생성 + ESLint + HTML박제검사 + smoke. `core.hooksPath=.githooks` (PC마다 1회).

## 흔한 오탐 주의 (검증 없이 고치지 말 것)
1. `new Date()` 시간대 — toKST 보정으로 KST선 정상.
2. center_id 미필터 / 세션 무효화 — 서버 프록시가 강제.
3. 빈배열/0나누기 — 다수 함수에 이미 `length` 가드 존재 → 실제 경로 확인 후 판단.
