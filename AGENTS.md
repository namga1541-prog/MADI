# MADI — 멀티에이전트 하네스 (Multi-Agent Harness)

> Claude가 모든 작업에서 자동으로 참조하는 병렬 실행 가이드.
> "어떤 에이전트를 몇 개, 어떤 모델로, 어떤 순서로 띄울지"를 표준화한다.

---

## 핵심 원칙 3가지

1. **파일 단독 소유** — 같은 파일을 두 에이전트가 동시에 수정하면 충돌 발생. 한 파일 = 한 에이전트.
2. **파티션 우선** — 작업 전 아래 파티션 테이블로 파일 → 도메인 매핑. 같은 도메인 파일은 같은 에이전트에 묶는다.
3. **웨이브 병렬** — 의존관계 없는 에이전트는 **단일 메시지** 내에서 동시 spawn (순차 호출 금지).

---

## 모델 티어 가이드

작업 복잡도에 따라 모델을 다르게 배정한다. 불필요하게 무거운 모델 사용은 속도·비용 낭비.

| 티어 | 모델 | 언제 사용 | Agent 파라미터 |
|------|------|----------|--------------|
| **Light** | `haiku` | 파일 탐색, grep, 영향 범위 분류, Pre-Scout | `model: "haiku"` |
| **Standard** | `sonnet` | 코드 감사, 버그 수정, 기능 구현 (기본값) | 생략 (기본) |
| **Heavy** | `opus` | 복잡한 아키텍처 설계, 대형 리팩토링 | `model: "opus"` |

> **규칙**: Pre-Scout·취합·분류 작업은 항상 haiku. 코드 읽기/쓰기는 sonnet 이상.

---

## 공통 컨텍스트 블록 (Slim Briefing) ✨ NEW

**목적**: 에이전트 브리핑 시 AGENTS.md 전체를 복사하는 대신, 이 블록 + 해당 도메인 파티션 행만 붙여넣는다.
토큰 40~60% 절약, 에이전트가 관련 없는 도메인 정보에 혼동되는 현상 방지.

**사용법**: 아래 블록을 각 에이전트 브리핑 상단에 삽입하고, 파티션 테이블에서는 해당 도메인 행만 발췌.

```
──────── MADI 공통 컨텍스트 ────────
프로젝트: 언어치료 센터 관리 웹앱 / GitHub Pages 정적 배포
경로: C:\Users\남재현\Desktop\madi-app

[코딩 규칙]
- var / function / .then() 패턴 엄수 — let/const/화살표함수/class 금지
- template literal(백틱) 사용 가능
- console.log 운영 코드 추가 금지
- escHtml() 없이 innerHTML에 사용자 데이터 삽입 금지

[DB 접근]
- 반드시 supaFetch() 경유 (직접 fetch + anon key 금지)
- 패턴: supaFetch('table?col=eq.val', 'GET').then(function(rows){...}).catch(function(e){ showToast('⚠️ '+e.message); })

[UI 패턴]
- 성공: showToast('✅ 저장됨')   오류: showToast('⚠️ 메시지')
- 역할 분기: if(currentUser.role==='superadmin'){} else if(currentUser.role==='admin'){} else {} // teacher

[커밋 규칙]
- 파일마다 Read → Edit 순서 (Read 없이 Edit 금지)
- 작업 완료 후 반드시: git add -A && git commit && git push origin main
────────────────────────────────────
```

> Slim Briefing을 쓰면 각 에이전트 프롬프트에 AGENTS.md 전체(~400줄)를 넣을 필요 없이
> 공통 블록(~20줄) + 도메인 파티션(~3줄) 만으로 충분하다.

---

## 파티션 테이블

| 도메인 | 담당 파일 | 비고 |
|--------|----------|------|
| **core** | `madi-01.js` `madi-01-auth.js` `madi-01-app.js` `madi-vocab.js` | 모든 도메인이 의존 — 단독 수정 시 다른 에이전트와 분리 |
| **session** | `madi-02.js` `madi-07.js` | 세션 기록, IEP |
| **home** | `madi-03.js` `madi-03-dashboard.js` | 홈·네비·대시보드 |
| **child-mgmt** | `madi-04.js` `madi-05.js` `madi-06.js` | 아동 관리·상세·성장기록 |
| **ai** | `madi-08.js` `madi-11.js` | AI 리포트·IEP, 표준화검사 |
| **calendar** | `madi-10.js` `madi-16.js` | 스케줄·캘린더, 빠른 기록 |
| **system** | `madi-12.js` `madi-12-chat.js` | PWA·권한·초기화, AI 비서 마로 |
| **report** | `madi-13.js` | 리포트·장단기계획 |
| **board** | `madi-14.js` `madi-14-board.js` | 공지·라운지·자료실 |
| **parent** | `madi-09.js` `madi-15.js` `madi-15-pages.js` | 학부모 포털 전체 |
| **edge** | `supabase/functions/ai-proxy/index.ts` `supabase/functions/login/index.ts` `supabase/functions/notify-tomorrow/index.ts` | Edge Functions (클라이언트와 완전 격리) |
| **static** | `sw.js` `index.html` `admin.html` `madi.css` | 정적 자산·PWA·공통 HTML |

---

## 도메인별 E2E 테스트 매핑

수정 완료 후 **어떤 테스트를 실행할지** 도메인에 따라 결정한다.

| 수정 도메인 | 실행 테스트 | 명령 |
|------------|-----------|------|
| core, auth | auth.spec.js 전체 | `npx playwright test auth` |
| session | forms.spec.js > 세션 기록 폼 | `npx playwright test forms` |
| calendar | buttons.spec.js > 캘린더 탭, navigation.spec.js > 내보내기 | `npx playwright test buttons navigation` |
| child-mgmt | buttons.spec.js > 아동 탭, forms.spec.js > 아동 추가 | `npx playwright test buttons forms` |
| ai | forms.spec.js > AI 언어평가보고서 폼 | `npx playwright test forms` |
| board | buttons.spec.js > 게시판 탭, navigation.spec.js > 게시판 | `npx playwright test buttons navigation` |
| system, home | buttons.spec.js > 헤더·보고서 탭 | `npx playwright test buttons` |
| **2개 이상 도메인** | **전체 44개** | `npx playwright test` |

> **환경 변수 필수**: `$env:TEST_USERNAME="dinosau"; $env:TEST_PASSWORD="ska930!@34"`

---

## 하네스 패턴 6종

---

### 1. 감사 하네스 (Audit Harness)

**트리거**: "점검", "에러 찾아", "버그 찾아", "전체 검사", "audit"

**실행 절차**:
1. **Pre-Scout**(haiku, 1개) 먼저 실행 → 실제 영향 도메인 식별 (패턴 5 참조)
2. 식별된 도메인만 에이전트 spawn (최대 6개 동시, 필요시 2 웨이브)
3. 모든 에이전트 완료 후 **취합 에이전트**(haiku, 1개) 실행 → 중복 제거·우선순위 정렬
4. Fix 하네스로 연결하거나 보고서 출력

**에이전트 브리핑 템플릿** (각 도메인 에이전트에 이 구조 사용):
> 💡 **Slim Briefing 적용**: 공통 컨텍스트 블록 + 이 도메인 파티션 행만 포함. AGENTS.md 전체 불필요.

```
[공통 컨텍스트 블록 붙여넣기 — 위 섹션 참조]

[도메인명] 감사 에이전트

프로젝트 경로: C:\Users\남재현\Desktop\madi-app
담당 파일: [파일1], [파일2], ...

아래 체크리스트 기준으로 담당 파일 전체를 전수 검사하라.
코드는 수정하지 말고 발견한 버그만 보고할 것.

──────────── 검사 항목 ────────────
[CRASH] document.getElementById(x).prop  — null 체크 없이 프로퍼티 접근
[CRASH] window.open() 결과 미체크 후 .document.write() 호출
[CRASH] JSON.parse() try-catch 없음 (localStorage / sessionStorage / DB 값)
[CRASH] .forEach/.map/.filter/.find 를 null/undefined 에 직접 호출
[CRASH] .split/.trim/.slice/.replace 를 null/undefined 에 직접 호출
[CRASH] 배열 인덱스 범위 미체크 후 접근 (.match()[0] 등)
[WRONG] 분모가 0이 될 수 있는 나누기 (maxY, vLimit, 길이 등)
[WRONG] parseInt/parseFloat 결과 NaN 미처리
[WRONG] for 루프 내 배열 길이 수정 (순방향 iterate + removeItem)
[WRONG] 클로저 캡처 경쟁조건 (비동기 Promise 체인에서 변수 덮어씀)
[XSS]   innerHTML 에 escHtml() 없이 DB/사용자 데이터 삽입
[XSS]   onclick 인라인 핸들러에 이스케이프 없이 ID/값 직접 삽입
[EDGE]  typeof 미체크로 undefined 함수 호출 (모듈 로드 순서 의존)
[EDGE]  private mode / 구브라우저에서 localStorage 접근 미보호
──────────────────────────────────

보고 형식 (버그 1개당 1줄):
[심각도] 파일명:줄번호 — 함수명() — 원인 한줄 설명
예) [CRASH] madi-08.js:92 — downloadPDF() — window.open() null 체크 없음

버그가 없으면 "✅ [도메인명] 이상 없음" 한 줄만 출력.
```

**취합 에이전트 브리핑 템플릿** (모델: haiku):

```
[취합] 감사 결과 Aggregator

아래는 각 도메인 감사 에이전트의 원본 결과다:
───────────────────────────────
[여기에 모든 에이전트 결과 붙여넣기]
───────────────────────────────

다음 규칙으로 취합·정제하라:
1. 중복 제거: 같은 파일·줄번호가 여러 에이전트에서 나오면 하나만 유지
2. 심각도 순 정렬: [CRASH] → [XSS] → [WRONG] → [EDGE] → [PERF]
3. 즉시 수정(CRASH·XSS)과 나중 처리(WRONG·EDGE·PERF) 두 섹션으로 분리
4. 도메인별 소계 (예: board 2건, ai 1건) 출력
5. 총계 한 줄 요약으로 마무리

수정 불필요한 "✅ 이상 없음" 도메인은 목록에서 제외.
```

**전체 감사 웨이브 구성**:

| 웨이브 | 에이전트 (6개 동시) |
|--------|-------------------|
| Pre-Scout (haiku) | 영향 도메인 식별 (1개) |
| 웨이브 1 | core · session · home · child-mgmt · ai · calendar |
| 웨이브 2 | system · report · board · parent · edge · static |
| 취합 (haiku) | Aggregator (1개) |

---

### 2. 수정 하네스 (Fix Harness)

**트리거**: "수정해줘", "고쳐줘", "fix", 감사 결과 수신 직후

**실행 절차**:
1. 수정 목록을 파티션 테이블 기준으로 도메인별 분류
2. **충돌 체크**: 각 파일이 정확히 하나의 에이전트에만 배정됐는지 확인
3. 단일 메시지에서 4~5개 에이전트 동시 spawn
4. 각 에이전트가 자신의 파일만 수정 + 개별 commit/push
5. **Fix-Verify 루프 실행** (패턴 6 참조) → 검증 실패 시 재수정
6. 완료 후 나머지 교차-도메인 이슈 순차 처리

**에이전트 브리핑 템플릿**:
> 💡 **Slim Briefing 적용**: 공통 컨텍스트 블록 + 이 도메인 파티션 행만 포함. AGENTS.md 전체 불필요.

```
[공통 컨텍스트 블록 붙여넣기 — 위 섹션 참조]

[도메인명] 수정 에이전트

프로젝트 경로: C:\Users\남재현\Desktop\madi-app
담당 파일: [파일1], [파일2], ...

수정 목록:
- [파일명] 줄 ~: [무엇을 어떻게 — 구체적인 수정 방법 명시]
- [파일명] 줄 ~: [...]

코딩 규칙 (반드시 준수):
- var / function / .then() 패턴 엄수 — let / const / 화살표함수 / class 금지
- template literal(백틱) 사용 가능
- console.log 추가 금지
- escHtml() 없이 innerHTML에 사용자 데이터 삽입 금지
- 파일마다 Read → Edit 순서 (읽기 없이 쓰기 금지)
- 작업 완료 후 git add -A && git commit && git push 실행
```

---

### 3. 기능 하네스 (Feature Harness)

**트리거**: "만들어줘", "추가해줘", "새 기능", "구현해줘"

**실행 절차**:

| 단계 | 방식 | 내용 |
|------|------|------|
| 1. 계획 (순차) | Plan 에이전트 1개 | 영향 파일 목록 + 도메인별 변경 명세 생성 |
| 2. 구현 (병렬) | 도메인별 에이전트 동시 spawn | 각 에이전트가 자기 파일만 구현 |
| 3. 통합 (순차) | 직접 처리 | 글루 코드 연결, 최종 commit |
| 4. 검증 (순차) | Fix-Verify 루프 | lint + smoke + E2E (패턴 6) |

**구현 에이전트 브리핑 템플릿**:
> 💡 **Slim Briefing 적용**: 공통 컨텍스트 블록 + 이 도메인 파티션 행만 포함. AGENTS.md 전체 불필요.

```
[공통 컨텍스트 블록 붙여넣기 — 위 섹션 참조]

[기능명] 구현 에이전트 — [역할: core/UI/로직/edge 중 하나]

프로젝트 경로: C:\Users\남재현\Desktop\madi-app
담당 파일: [파일 목록]

기능 명세:
[요구사항 — 어떤 데이터, 어떤 UI, 어떤 동작]

선행 에이전트 완료 내용 (있는 경우):
[다른 에이전트가 이미 처리한 부분 요약]

이 에이전트가 구현할 내용:
- [변경 항목 1]
- [변경 항목 2]

코딩 규칙: var / function / .then() — let/const/화살표함수 금지
완료 후 commit 하지 말 것 (통합 단계에서 일괄 처리).
```

**기능 하네스 역할 분리 예시**:
```
새 기능 X 추가 시:
├── core 에이전트    → 공통 유틸 함수·상수 추가 (madi-01.js)
├── UI 에이전트      → index.html 마크업 + madi.css 스타일
├── 로직 에이전트    → 비즈니스 로직 파일 수정
└── edge 에이전트    → 필요 시 Edge Function 신규 또는 수정
```

---

### 4. 리뷰 하네스 (Review Harness)

**트리거**: "코드 리뷰", "검토해줘", "배포 전 체크", "PR 확인"

감사 하네스와 동일하되 **코드 수정 없이 보고서만 생성**. 추가 검사 항목:

```
[PERF] 루프 내 반복 DOM 쿼리 (getElementById를 매 반복마다 호출)
[PERF] 불필요한 전체 재렌더링 (childDB 전체를 매 이벤트마다 순회)
[UX]   에러 발생 시 showToast 없이 silent fail
[SEC]  supaFetch() 우회하고 직접 Supabase URL fetch
[SEC]  parent 역할이 teacher/admin 전용 함수 호출 가능한 경로
[SEC]  innerHTML 에 사용자 입력이 escHtml() 없이 노출
```

---

### 5. Pre-Scout 패턴 ✨ NEW

**목적**: 본격 감사·수정 전에 **탐색 전용 에이전트(haiku)** 를 먼저 실행해서
실제로 영향받는 도메인만 추려낸다. 불필요한 에이전트 spawn 방지.

**사용 시점**:
- 전체 감사 요청이지만 최근 변경이 일부 도메인에만 집중된 경우
- "어디가 문제인지 모르겠는데 찾아줘" 류의 열린 요청
- 수정 범위를 확정하기 전 영향 분석이 필요한 경우

**Pre-Scout 브리핑 템플릿** (모델: **haiku** 필수):

```
[Pre-Scout] 영향 범위 분석 에이전트

프로젝트 경로: C:\Users\남재현\Desktop\madi-app

목표: 아래 질문/작업의 영향 범위를 파악해서 "어느 도메인 에이전트를 실행해야 하는지" 결정한다.

작업 내용:
[사용자 요청 또는 변경 내역 한 줄 설명]

수행할 것:
1. `git diff HEAD~1 --name-only` 또는 관련 키워드로 최근 변경 파일 확인
2. 변경 파일을 아래 파티션 테이블에 매핑:
   core: madi-01.js, madi-01-auth.js, madi-01-app.js, madi-vocab.js
   session: madi-02.js, madi-07.js
   home: madi-03.js, madi-03-dashboard.js
   child-mgmt: madi-04.js, madi-05.js, madi-06.js
   ai: madi-08.js, madi-11.js
   calendar: madi-10.js, madi-16.js
   system: madi-12.js, madi-12-chat.js
   report: madi-13.js
   board: madi-14.js, madi-14-board.js
   parent: madi-09.js, madi-15.js, madi-15-pages.js
   edge: supabase/functions/**
   static: sw.js, index.html, admin.html, madi.css
3. 영향 도메인 목록과 이유를 한 줄씩 출력
4. "실행 불필요" 도메인은 명시적으로 제외 이유 작성

출력 형식:
✅ 실행 필요: board (madi-14.js 변경), ai (madi-08.js 변경)
⏭️ 스킵: core, session, home, child-mgmt, calendar, system, report, parent, edge, static — 변경 없음
```

**Pre-Scout 결과 활용**:
```
Pre-Scout 결과 → "board, ai만 영향"
  → 감사: board 에이전트 + ai 에이전트만 spawn (12개 → 2개)
  → E2E: buttons.spec.js + forms.spec.js만 실행
```

---

### 6. Fix-Verify 루프 ✨ NEW

**목적**: 수정 에이전트 완료 후 **자동 검증 → 실패 시 재수정** 사이클을 돌려서
"수정했는데 다른 오류 생김" 상황을 원천 차단한다.

**실행 절차** (수정 하네스 완료 직후 항상 실행):

```
Step 1 — ESLint (XSS 감지)
  명령: npm run lint
  실패 시: 실패한 파일의 도메인 에이전트 재spawn (수정 브리핑에 lint 오류 첨부)
  성공 시: Step 2 진행

Step 2 — 유닛 테스트
  명령: node tests/smoke.js
  실패 시: core 에이전트 재spawn
  성공 시: Step 3 진행

Step 3 — E2E 테스트 (도메인 매핑 테이블 기준)
  명령: $env:TEST_USERNAME="dinosau"; $env:TEST_PASSWORD="ska930!@34"; npx playwright test [관련 spec]
  실패 시: 실패 테스트 오류 메시지 + 스크린샷을 해당 도메인 에이전트에 전달 → 재수정
  성공 시: ✅ 검증 완료 → git push

재시도 한도: 각 Step 당 최대 2회. 2회 실패 시 대장님께 보고 후 중단.
```

**Fix-Verify 재수정 브리핑 추가 항목**:

```
[재수정] 이전 수정에서 아래 오류가 발생했다. 원인을 분석하고 수정하라.

오류 내용:
[lint/smoke/playwright 오류 메시지 전문]

실패 파일/테스트:
[파일명 또는 테스트명]

주의: 이전 수정 내용은 유지하면서 이 오류만 추가 수정할 것.
```

---

### 7. Post-Deploy Sentinel ✨ NEW

**목적**: `git push` 후 GitHub Pages 배포(1~2분) 완료 시점에 라이브 URL을 검증한다.
로컬 Fix-Verify 루프를 통과했지만 "배포 후 깨짐" 케이스를 잡아낸다.

**사용 시점**: `git push` 직후, 1~2분 대기 후 실행

**실행 명령**:
```bash
npx playwright test --project=sentinel
```

**검증 내용** (`tests/e2e/sentinel.spec.js` — 인증 불필요, 약 20초 소요):
1. 랜딩 페이지 렌더링 (`#landingScreen` 노출)
2. 로그인 버튼 노출 + 활성화
3. 로그인 폼 렌더링 (`#loginScreen`, 필드 3개)
4. 로그인 성공 후 메인 앱 진입 (TEST_PASSWORD 있을 때)

**실패 시 처리**:
```
라이브 에러 메시지 + 스크린샷 → 해당 도메인 에이전트에 전달 → 재수정 → 재push
최대 1회 재시도. 2회 실패 시 대장님께 즉시 보고.
```

**playwright.config.js sentinel 프로젝트**:
```js
{
  name: 'sentinel',
  testMatch: '**/sentinel.spec.js',
  use: {
    ...devices['Desktop Chrome'],
    baseURL: 'https://namga1541-prog.github.io',
  },
}
```

---

## 충돌 방지 체크리스트

에이전트 spawn 전 반드시 확인:

- [ ] 각 파일이 정확히 한 에이전트에만 배정됐는가?
- [ ] `core` 도메인을 수정하는 에이전트가 2개 이상인가? → 하나로 통합
- [ ] Edge Function과 클라이언트 파일이 같은 에이전트에 있는가? → 분리
- [ ] `index.html` 수정이 필요한 에이전트가 여럿인가? → static 에이전트 1개로 통합

---

## 의존성 규칙

```
core (madi-01*.js, madi-vocab.js)
  └── 모든 도메인이 import 없이 전역 스코프로 의존
  └── core 수정 시: 다른 에이전트와 웨이브를 분리하거나 단독 처리

edge (supabase/functions/*)
  └── 클라이언트 코드와 완전 독립 → 항상 별도 에이전트 가능

static (index.html)
  └── 모든 도메인의 HTML 마크업 포함
  └── HTML 수정 필요 시 static 에이전트 분리,
      나머지 JS 에이전트는 병렬 진행 가능
```

---

## 웨이브 크기 가이드

| 작업 유형 | Pre-Scout | 웨이브 크기 | 검증 | 배포 후 Sentinel |
|----------|-----------|------------|------|----------------|
| 전체 감사 | ✅ 실행 | 최대 6 + 6 (2 웨이브) | Fix-Verify 루프 | ✅ 실행 |
| 부분 감사 | ✅ 실행 | Pre-Scout 결과 기반 (1~6) | Fix-Verify 루프 | ✅ 실행 |
| 수정 작업 | 선택 | 4~5 (1 웨이브) | Fix-Verify 루프 필수 | ✅ 실행 |
| 기능 구현 | 선택 | 3~4 (1 웨이브) | Fix-Verify 루프 필수 | ✅ 실행 |
| 배포 전 리뷰 | ✅ 실행 | 최대 6 + 6 (2 웨이브) | E2E 전체 실행 | ✅ 실행 |

---

## 즉시 참조 — 도메인별 파일 목록 (복사용)

```
core       : madi-01.js, madi-01-auth.js, madi-01-app.js, madi-vocab.js
session    : madi-02.js, madi-07.js
home       : madi-03.js, madi-03-dashboard.js
child-mgmt : madi-04.js, madi-05.js, madi-06.js
ai         : madi-08.js, madi-11.js
calendar   : madi-10.js, madi-16.js
system     : madi-12.js, madi-12-chat.js
report     : madi-13.js
board      : madi-14.js, madi-14-board.js
parent     : madi-09.js, madi-15.js, madi-15-pages.js
edge       : supabase/functions/ai-proxy/index.ts
             supabase/functions/login/index.ts
             supabase/functions/notify-tomorrow/index.ts
static     : sw.js, index.html, admin.html, madi.css
```
