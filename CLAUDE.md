# 아이마디아이 (MADI) — Claude 작업 가이드

## Claude 응대 규칙 (최우선 적용)

- **호칭**: 사용자를 항상 **대장님**이라고 부른다.
- **말투**: 반드시 **존댓말(격식체)** 을 사용한다. 반말 절대 금지.
- 이 규칙은 어떤 상황에서도 예외 없이 적용된다.

---

## 프로젝트 개요
언어치료 센터 전용 관리 웹앱. GitHub Pages 정적 배포 (빌드 도구 없음).
- 운영 URL: `https://namga1541-prog.github.io/MADI/`
- 백엔드: Supabase (REST API + Edge Functions)
- 인증: 자체 JWT (Edge Function `/login`)

### 📌 작업 전 필독 (탐색 비용·오탐 절감)
- **[ARCHITECTURE.md](./ARCHITECTURE.md)** — 불변 사실 치트시트(ID 문자열·toKST·저장흐름·서버보안·전역변수 위치). 수정·감사 전에 읽으면 재조사·오탐 방지.
- **[FUNCTIONS.md](./FUNCTIONS.md)** — 이름→파일:라인 인덱스(자동 생성). 위치는 여기서 찾아 **±15줄만 Read**.
- 검증: `npm run check` (lint + smoke + 재발버그 패턴) 한 번에.

## 파일 구조
| 파일 | 역할 |
|------|------|
| `index.html` | 메인 앱 (선생님/관리자 UI) |
| `admin.html` | 관리자 센터 |
| `madi-core.js` | 공통 유틸, 상수, supaFetch, supaCache, data-action 위임 |
| `madi-pii.js` | AI 개인정보 가명화 SSOT (`madiNameMasker` 다중아동 마스커) — core 직후 로드 |
| `madi-auth.js` | 랜딩·로그인·회원가입·로그아웃·비밀번호 변경 |
| `madi-app.js` | DB 로드, 다크모드, 헤더 시계, 네트워크 모니터, 학부모 UI |
| `madi-session.js` | 세션 기록 |
| `madi-home.js` | 홈·네비게이션·공지·서비스 설정 |
| `madi-dashboard.js` | 페르소나별 대시보드 렌더링 (Teacher/Admin) |
| `madi-children.js` | 아동 관리 |
| `madi-child-detail.js` | 아동 상세 |
| `madi-growth.js` | 성장 기록 |
| `madi-iep.js` | IEP |
| `madi-ai.js` | AI 기능 (Anthropic API) |
| `madi-parent.js` | 학부모 포털 |
| `madi-schedule.js` | 스케줄·캘린더 |
| `madi-assessment.js` | 표준화검사 (AI 언어평가) |
| `madi-system.js` | 감통 평가 + 권한·PWA·초기화 (GitHub 배포는 madi-deploy.js 로 분리) |
| `madi-deploy.js` | GitHub 원클릭 배포 + 마디 폴더핸들(IndexedDB) — system.js 앞 로드 |
| `madi-chat.js` | 플로팅 AI 비서 (chat / 매크로 / 음성) |
| `madi-report.js` | 리포트·장단기계획 |
| `madi-board-notice.js` | 게시판 — 공지 (글로벌·센터) |
| `madi-board.js` | 게시판 — 라운지(고객센터)·자료실·편집 모달 |
| `madi-parent-home.js` | 학부모 포털 — 홈 대시보드 및 렌더러 |
| `madi-parent-pages.js` | 학부모 포털 — 일정·포트폴리오·리포트·알림·가입·푸시 |
| `madi-quick.js` | ⚡ 빠른 기록 모드 (선생님 모바일 우선) |
| `madi-vocab.js` | 한국 임상 어휘 사전 + AI 후처리 검열기 (다른 madi-*.js 보다 먼저 로드) |
| `madi.css` | 전역 스타일 |
| `sw.js` | Service Worker (캐시 — 커밋 시 자동 갱신) |

## 역할 체계
- `superadmin`: 플랫폼 전체 관리자 (username: dinosau)
- `admin`: 센터장
- `teacher`: 선생님
- `parent`: 학부모

## 버그 디버깅 규정 (2026-06-01 수립 — 반복 실수 방지)

> 오늘 "드래그가 안 됨"을 마로 버튼 드래그로 오해해 수 시간을 낭비한 사건에서 도출.

### 규정 1 — 증상을 한 문장으로 확정하고 시작한다
- 인터랙션 키워드(드래그·스크롤·클릭·이동·안 됨)가 포함된 버그 리포트는 코드를 보기 전에 반드시 확인한다:
  **"정확히 어떤 요소를 어떻게 조작했을 때, 어떤 결과가 나와야 하는데, 어떤 결과가 나옵니까?"**
- 이 한 문장이 없으면 어떤 수정도 시작하지 않는다.

### 규정 2 — 스크롤·터치 버그는 CSS를 JS보다 먼저 본다
스크롤/터치 계열 버그의 원인은 90%가 CSS다. JS 핸들러를 수정하기 전에 반드시 먼저 확인:
1. `overscroll-behavior` (안드로이드에서 body 스크롤 차단)
2. `overflow: hidden` — html/body/부모 컨테이너
3. `touch-action: none` — 광범위 적용 여부
4. `position: fixed` 오버레이 — z-index가 높아 터치를 가로채는 레이어

### 규정 3 — 수정 2회 후 동일 증상이면 가설 자체를 버린다
- 같은 가설로 고친 코드를 배포했는데 2번 연속 "여전히 안 됨"이라면, **코드가 아니라 가설이 틀린 것이다.**
- 세 번째 수정 대신 진단을 재시작한다: 증상 재정의 → 원인 후보 목록 초기화 → 새 가설.

### 규정 4 — "코드가 정상"과 "사용자 확인"은 다르다
- 프리뷰/eval/로컬에서 작동을 확인했어도, 사용자가 "안 된다"고 하면 즉시 **환경 차이**를 의심한다:
  - PWA 캐시 → 새 코드가 실제로 실행 중인가?
  - 브라우저·OS 차이 → 같은 코드가 다르게 동작하는가?
  - 다른 CSS/JS가 덮어쓰고 있는가?
- "로컬에서 됩니다"는 보고가 아니라 가설이다.

### 규정 5 — PWA 캐시 의심 우선순위
디바이스에서 동작이 배포 후에도 바뀌지 않으면, 코드 수정 전에 먼저 묻는다:
**"혹시 새로고침/재설치 후에도 같은 증상입니까?"**
캐시가 원인이면 아무리 고쳐 배포해도 디바이스에 도달하지 않는다.

---

## 핵심 규칙

### 코딩 컨벤션
- 바닐라 JS (ES2015+ 사용, 모던 브라우저 타겟) — `var`/`function`/`.then()` 일관성 유지
  · arrow function·class·let·const 미사용 — 코드 통일성 + 호이스팅 일관성
  · template literal(백틱) 자유롭게 사용 (이미 다수). IE11 등 ES5 단독 환경은 미지원
- 전역 변수: `childDB`, `sessionDB`, `scheduleDB`, `assessmentDB` 등
- DB 접근: 반드시 `supaFetch()` 경유 (직접 Supabase anon key 사용 금지)
- HTML ID 네이밍: camelCase (`schedChildSel`, `bdPanel_lounge`)
- **이벤트 바인딩(신규 코드)**: 인라인 `onclick="fn(...)"` 대신 `data-action` 위임 사용.
  · `<button data-action="saveChild" data-arg="123">` → 단일 위임 핸들러(madi-core.js)가 `saveChild('123', el, ev)` 호출. 여러 인자는 `el.dataset` 에서 읽기.
  · 이유: onclick 에 함수명을 문자열로 박으면 HTML↔JS 가 이름으로 결합돼 리네임이 grep/ESLint 로 보장 안 되는 위험 작업이 됨. 기존 onclick 226곳은 점진 이관(일괄 변환 금지), 새 핸들러만 이 패턴.
- **AI 다중 아동 가명화**: 외부 LLM 에 여러 아동을 보낼 땐 반드시 `madiNameMasker(children)`(madi-pii.js) 경유 — `mask`/`restore` 왕복. 가명화 로직 복붙 금지(보안 불변식 SSOT). 단일 아동은 `aliasName()`/`restoreName()`(madi-core.js).

### 보안
- 모든 사용자 입력은 `escHtml()` 처리
- 서버 필터링은 Edge Function에서 수행 — 클라이언트 필터만으로 보안 불가
- RLS 정책이 있으므로 DB 직접 접근 주의

### 배포
- `main` 브랜치 push → GitHub Pages 자동 배포 (1~2분 소요)
- `sw.js` 캐시 버전은 pre-commit 훅이 자동 갱신 (수동 변경 불필요)
  · 훅 실체: 버전 관리되는 `.githooks/pre-commit` (sw.js CACHE_NAME 갱신 + FUNCTIONS.md 재생성 + ESLint + HTML박제검사 + 로드순서검사 + smoke)
  · **PC마다 최초 1회 설치 필요**: `git config core.hooksPath .githooks`
  · 정적 자산(JS/CSS/HTML)이 스테이징된 커밋에서만 CACHE_NAME 갱신
- 변경 후 반드시 강제 새로고침 안내 (Ctrl+Shift+R)

### 자동 커밋·푸시 (필수)
- **모든 코드 수정 작업 완료 후 별도 언급 없어도 반드시** `git add -A && git commit && git push origin main` 실행
- worktree에서 작업 시: worktree 커밋 → main에 cherry-pick → push 순서로 진행
- 사용자가 명시적으로 "커밋하지 마" 라고 하지 않는 한 항상 자동 배포까지 완료

### 작업 완료 시 개선 제안
- 작업 완료 응답 끝에 "🔮 추가 개선 제안" 섹션을 붙일 수 있음 — **개수 제한 없음, 억지 금지**
- 진짜 발견한 것만: **"이번 작업 중 발견했지만 손대지 않은 것"** 위주 — 컨텍스트가 살아있을 때만 가능한 발견
- 제안할 것이 없으면 섹션 자체를 생략 — 억지로 채우는 것이 더 나쁨
- 제안 종류 예시: 후속 리팩토링, 새로 발견한 UX/보안 약점, 부수 최적화

### Edge Function 배포
- **반드시 `--no-verify-jwt` 플래그 포함** — 없으면 Supabase 미들웨어가 모든 요청을 401로 차단
  ```
  supabase functions deploy <name> --project-ref ujxdhafzjyrglaclarwe --no-verify-jwt
  ```
- 배포 후 엔드포인트 직접 호출로 동작 확인 필수

### 금지 사항
- `npm install`, `package.json` 의존성 추가 금지 (정적 사이트)
- `console.log` 운영 코드에 추가 금지
- Supabase anon key를 소스에 하드코딩 금지

## DB 스키마

> **정본은 [SCHEMA.md](./SCHEMA.md) 하나뿐이다.** (중복 표를 두지 않는다 — 과거 `status` 컬럼 오기처럼 사본이 갈라지는 사고 방지.)
> 컬럼 참조·추가 전 SCHEMA.md 확인. SQL 실행 순서는 [MIGRATIONS_RUNBOOK.md](./MIGRATIONS_RUNBOOK.md).

## 멀티에이전트 하네스

> 상세 파티션 테이블·브리핑 템플릿·충돌 규칙·패턴 → **[AGENTS.md](./AGENTS.md)** 참조

### 자동 트리거 조건

| 조건 | 동작 |
|------|------|
| 영향 파일 **3개 이상** | Pre-Scout(haiku) → 도메인 분류 → 병렬 에이전트 |
| "점검 / 에러 찾아 / audit" | 감사 하네스 — Pre-Scout → 최대 6+6 에이전트 + Aggregator |
| "수정 / 고쳐 / fix" | 수정 하네스 — 도메인별 4~5 에이전트 + Fix-Verify Loop |
| "만들어 / 추가 / 구현" | 기능 하네스 — 계획(순차) → 구현(병렬) → 통합(순차) |
| 영향 파일 1~2개 | 직접 처리 (에이전트 불필요) |

### 단순 수정 — 토큰·시간 절약 규칙 (필수)
> 파일이 커지면서 간단 수정에도 토큰·시간이 과하게 드는 문제 대응.

- **단순 수정(1~2 파일·버그 1건·텍스트/로직 소폭 변경)에는 멀티에이전트 하네스를 쓰지 않는다.** 에이전트는 전수감사·5+파일 대형 작업에만.
- **위치 탐색은 [FUNCTIONS.md](./FUNCTIONS.md) 우선.** 함수명 → 파일:라인 인덱스(pre-commit 자동 생성)에서 줄번호를 찾아 **해당 줄 ±15줄만 Read** 한다. 전체 파일 통독 금지.
  - FUNCTIONS.md 에 없으면(중첩 함수 등) Grep 으로 정확한 라인을 찾고 그 부분만 Read.
- **이미 읽은 파일을 재독하지 않는다.** Edit 는 성공/실패를 즉시 알려주므로 수정 후 "확인용 재读" 불필요.
- 트리거 표의 "3개 이상 → 에이전트" 는 **새 기능·대규모 리팩토링** 기준이며, 단순 버그 수정이 우연히 3파일을 건드리는 경우는 직접 처리한다.

### 모델 티어
| 티어 | 용도 |
|------|------|
| `haiku` | Pre-Scout(도메인 분류), Aggregator(중복 제거), 탐색·분류 |
| `sonnet` | 기본 코드 작업, 수정, 기능 구현 (기본값) |
| `opus` | 아키텍처 설계, 복잡한 리팩토링, 보안 심층 감사 |

### Slim Briefing (에이전트 브리핑 경량화)
- 에이전트 브리핑에 AGENTS.md 전체 대신 **공통 컨텍스트 블록 + 해당 도메인 파티션 행만** 포함
- AGENTS.md `## 공통 컨텍스트 블록` 섹션을 복사해 각 에이전트 브리핑 상단에 붙여넣기
- 토큰 40~60% 절약, 에이전트 포커스 향상

### Fix-Verify Loop (수정 후 필수)
```
npm run lint  →  node tests/smoke.js  →  npx playwright test
```
- 각 단계 실패 시 즉시 재수정, 최대 2회 재시도
- 모든 단계 통과 후 커밋·푸시

### Post-Deploy Sentinel (배포 후 필수)
```
npx playwright test --project=sentinel
```
- `git push` 직후 1~2분 대기 후 실행 (GitHub Pages 배포 완료 대기)
- 약 20초 소요, 라이브 URL 대상 스모크 4개 테스트
- 실패 시 해당 도메인 에이전트 재수정 → 재push → 재검증

### Post-Work Auto-Verify (작업 완료 후 자동)
- **Layer 1 (자동)**: Stop 훅이 madi-*.js 변경 감지 시 ESLint + Smoke 자동 실행 — 별도 지시 불필요
- **Layer 3 (수동 트리거)**: JS 파일 **5개 이상** 변경된 대형 작업 완료 후 `spawn_task`로 Post-Verify Agent 자동 호출
  - Post-Verify Agent: `npm run lint` → `node tests/smoke.js` → `npx playwright test --project=sentinel` 순서로 전체 검증
  - 성공 시 "✅ 전체 검증 통과" 보고, 실패 시 파일명:라인 보고 후 재수정
- 검증 실패 시 커밋·푸시 전 재수정 필수 (Fix-Verify Loop와 동일 원칙)

### 병렬 실행 원칙
- 의존관계 없는 에이전트는 **단일 메시지** 내 동시 spawn (순차 금지)
- 각 에이전트에는 **담당 파일만** 배정 (파일 중복 배정 = 충돌)
- `core` 도메인 수정 시 다른 에이전트와 웨이브 분리

## 테스트
```bash
node tests/smoke.js   # 유틸 함수 유닛 테스트
```
pre-commit 훅에서 자동 실행됨.

## ESLint (XSS 자동 차단)

pre-commit 훅이 스테이징된 `madi-*.js`에 대해 자동 실행됨.

```bash
npm run lint          # 전체 검사
npm run lint:fix      # 자동 수정 가능한 것만 수정
npx eslint madi-ai.js # 특정 파일만
```

**핵심 규칙**: `no-unsanitized/property`, `no-unsanitized/method`
- `el.innerHTML = userValue` → 커밋 차단
- `el.innerHTML = escHtml(userValue)` → 통과
- `el.innerHTML = '<div>' + escHtml(name) + '</div>'` → 통과

## 자주 쓰는 패턴

### supaFetch 사용
```js
supaFetch('madi_users?id=eq.' + id, 'GET')
  .then(function(rows) { ... })
  .catch(function(err) { showError(err, '사용자 조회'); });  // 원문 노출 금지 — showError 경유
```

### 에러 처리 (`.catch` 표준 — showError)
`.catch` 에서 `err.message` 원문을 그대로 토스트하지 말 것. 서버 원문엔 상태코드·테이블/컬럼명이 섞여 사용자에게 무의미하고 내부구조가 노출된다. `showError(err, action)`(madi-app.js)가 `_userErrMsg` 로 친화 문구를 만들고 원문은 console.warn 로 로깅한다.
```js
.catch(showError)                       // 가장 짧은 형태(action 생략 → '요청')
.catch(function(e){ showError(e, '저장'); });  // 맥락 라벨 부여
```

### 토스트 메시지
```js
showToast('✅ 저장됨');   // 성공
showToast('⚠️ 오류');    // 경고 (단발 안내). 에러 객체가 있으면 showToast 대신 showError 사용
```

### 역할 분기
```js
if (currentUser.role === 'superadmin') { ... }
else if (currentUser.role === 'admin') { ... }
else { ... } // teacher
```
