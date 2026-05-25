# MADI — 멀티에이전트 하네스 (Multi-Agent Harness)

> Claude가 모든 작업에서 자동으로 참조하는 병렬 실행 가이드.
> "어떤 에이전트를 몇 개 동시에 띄울지"를 표준화한다.

---

## 핵심 원칙 3가지

1. **파일 단독 소유** — 같은 파일을 두 에이전트가 동시에 수정하면 충돌 발생. 한 파일 = 한 에이전트.
2. **파티션 우선** — 작업 전 아래 파티션 테이블로 파일 → 도메인 매핑. 같은 도메인 파일은 같은 에이전트에 묶는다.
3. **웨이브 병렬** — 의존관계 없는 에이전트는 **단일 메시지** 내에서 동시 spawn (순차 호출 금지).

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

## 하네스 패턴 4종

---

### 1. 감사 하네스 (Audit Harness)

**트리거**: "점검", "에러 찾아", "버그 찾아", "전체 검사", "audit"

**실행 절차**:
1. 관련 도메인 선택 (전체 감사 → 12개, 부분 감사 → 해당 도메인만)
2. 단일 메시지에서 최대 6개 에이전트 동시 spawn (전체면 2 웨이브)
3. 결과 취합 → `[CRASH]` → `[WRONG]` → `[XSS]` → `[EDGE]` 순 정렬
4. Fix 하네스로 연결하거나 보고서 출력

**에이전트 브리핑 템플릿** (각 도메인 에이전트에 이 구조 사용):

```
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
```

**전체 감사 웨이브 구성**:

| 웨이브 | 에이전트 (6개 동시) |
|--------|-------------------|
| 웨이브 1 | core · session · home · child-mgmt · ai · calendar |
| 웨이브 2 | system · report · board · parent · edge · static |

---

### 2. 수정 하네스 (Fix Harness)

**트리거**: "수정해줘", "고쳐줘", "fix", 감사 결과 수신 직후

**실행 절차**:
1. 수정 목록을 파티션 테이블 기준으로 도메인별 분류
2. **충돌 체크**: 각 파일이 정확히 하나의 에이전트에만 배정됐는지 확인
3. 단일 메시지에서 4~5개 에이전트 동시 spawn
4. 각 에이전트가 자신의 파일만 수정 + 개별 commit/push
5. 완료 후 나머지 교차-도메인 이슈 순차 처리

**에이전트 브리핑 템플릿**:

```
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

**구현 에이전트 브리핑 템플릿**:

```
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

| 작업 유형 | 웨이브 크기 | 이유 |
|----------|------------|------|
| 전체 감사 | 6 + 6 (2 웨이브) | 12개 도메인 전수 커버 |
| 수정 작업 | 4~5 (1 웨이브) | 결과 취합·검증 용이 |
| 기능 구현 | 3~4 (1 웨이브) | 도메인 간 의존성 관리 |
| 배포 전 리뷰 | 6 + 6 (2 웨이브) | 전체 커버리지 |

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
