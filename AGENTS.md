# MADI — 멀티에이전트 하네스 (Multi-Agent Harness)

> Claude가 모든 작업에서 자동으로 참조하는 병렬 실행 가이드.
> "어떤 에이전트를 몇 개, 어떤 모델로, 어떤 순서로 띄울지"를 표준화한다.

---

## ⚡ 빠른 참조 — 요청 유형 → 패턴

| 요청 키워드 | 영향 파일 | 패턴 | 에이전트 수 |
|------------|----------|------|------------|
| 점검 / 에러 찾아 / audit | 전체 | [1] Audit | Pre-Scout → 최대 12개 병렬 |
| 수정 / 고쳐 / fix | 3개 이상 | [2] Fix | Pre-Scout → 도메인별 4~5개 병렬 |
| 만들어 / 추가 / 구현 | 3개 이상 | [3] Feature | Architect → Implementer N개 → Reviewer |
| 리뷰 / 검토 | 전체 | [4] Review | 독립 리뷰어 1~3개 |
| 영향 파일 1~2개 | 1~2개 | 직접 처리 | 에이전트 불필요 |
| **작업 완료 후 항상** | — | [10] Auto-Verify | Stop 훅 자동 / 5파일+ 시 spawn |

> **Slim Briefing**: 에이전트 브리핑 시 `.claude/slim-context.md` Read 한 줄로 공통 컨텍스트 주입.
> AGENTS.md 전체 복붙 금지 — 해당 도메인 파티션 행만 추가 발췌.

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

## 토큰 예산 관리

병렬 에이전트는 토큰 비용이 곱셈으로 증가한다. spawn 전 아래 기준 확인 필수.

| 구성 | 비용 수준 | 허용 조건 |
|------|---------|---------|
| haiku × 6 | 저 | 제한 없음 |
| sonnet × 6 | 중 | 영향 파일 6개 이상일 때만 |
| opus × 1~2 | 중 | 아키텍처 설계·복잡 리팩토링만 |
| opus × 3 이상 | 고 | **대장님께 먼저 확인 후 실행** |

### 서킷 브레이커 규칙

- 동일 파일 수정 에이전트가 2회 연속 실패 → 자동 중단, 대장님께 보고
- Pre-Scout 없이 전체 12도메인 spawn → **금지** (Pre-Scout 먼저)
- 영향 파일 1~2개인데 에이전트 spawn → 직접 처리 (하네스 오버헤드 불필요)
- 재시도 한도: 각 단계 최대 2회 — 2회 초과 시 즉시 중단 후 보고

---

## 공통 컨텍스트 블록 (Slim Briefing)

**목적**: 에이전트 브리핑 시 AGENTS.md 전체를 복사하는 대신, 이 블록 + 해당 도메인 파티션 행만 붙여넣는다.
토큰 40~60% 절약, 에이전트가 관련 없는 도메인 정보에 혼동되는 현상 방지.

**사용법**: 에이전트 브리핑 상단에 `Read .claude/slim-context.md` 한 줄 추가 — 파일이 독립 분리되어 있음.
파티션 테이블에서는 해당 도메인 행만 발췌해 함께 첨부.

> 아래는 `.claude/slim-context.md` 내용과 동일한 참고본 (인라인 복붙 용).

```
──────── MADI 공통 컨텍스트 ────────
프로젝트: 언어치료 센터 관리 웹앱 / GitHub Pages 정적 배포
경로: (현재 작업 디렉토리 — 에이전트 spawn 시 `pwd` 결과 삽입)

[코딩 규칙]
- var / function / .then() 스타일 유지 — let/const/화살표함수/class 미사용
- template literal(백틱) 사용 가능
- console.log 운영 코드 추가 금지
- escHtml() 없이 innerHTML에 사용자 데이터 삽입 금지

[DB 접근]
- 반드시 supaFetch() 경유 (직접 fetch + anon key 금지)
- 패턴: supaFetch('table?col=eq.val', 'GET').then(function(rows){...}).catch(function(e){ showToast('⚠️ '+e.message); })

[DB 스키마 핵심 — 존재하지 않는 컬럼 select 시 PostgREST 400 반환]
- madi_users       : id, username, name, password, role, center_id, color, permissions,
                     status, prog_types(JSONB), totp_secret, totp_enabled, locked_until
- madi_centers     : id  (center_id로 사용)
- madi_settings    : key, value  ⚠️ center_id 컬럼 없음 — 전역 테이블
- madi_portfolios  : id, child_id, center_id, parent_visible, month, content, data, created_at
- madi_notifications: id, user_id, center_id, type, title, body, link, read_at, created_at
- madi_audit_log   : id, actor_id, actor_name, action, table_name, record_id, child_id, changed_cols, occurred_at
- madi_push_settings: center_id, enabled, push_time, message_title, message_body, last_sent_date
- madi_rate_limits : key(PK), count, window_start, hour_count, hour_start, updated_at

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

### 에이전트 읽기 규율 (토큰·오탐 동시 절감 — 필수)
모든 탐색·감사 에이전트 브리핑에 아래를 명시한다:
1. **먼저 `ARCHITECTURE.md` 와 `FUNCTIONS.md` 를 읽어라.** (불변 사실 + 위치 인덱스)
2. **파일을 통째로 읽지 마라.** FUNCTIONS.md 에서 줄번호를 찾아 **해당 함수 ±20줄만 Read**. (200줄 미만 파일만 통독 허용)
3. **ARCHITECTURE.md 의 "흔한 오탐 주의" 를 보고하기 전에 대조하라.** 특히:
   - `new Date()` 시간대 → toKST 보정으로 KST선 정상 (오탐 금지)
   - center_id 미필터 / 세션 무효화 → `api` 프록시가 서버에서 강제 (서버 코드 확인 전 보고 금지)
   - 빈배열/0나누기 → 다수 함수에 가드 존재 (실제 라인 확인 후 판단)
4. 발견은 **파일:라인 + 코드 인용 + 재현 시나리오** 필수. 추측·억지 금지.

> 이 규율 하나로 감사 토큰이 크게 줄고, "서버를 안 봐서 생기는 보안 오탐"·"toKST 모르는 날짜 오탐" 이 사전 차단된다.

---

## 파티션 테이블

| 도메인 | 담당 파일 | 비고 |
|--------|----------|------|
| **core** | `madi-core.js` `madi-auth.js` `madi-app.js` `madi-vocab.js` | 모든 도메인이 의존 — 단독 수정 시 다른 에이전트와 분리 |
| **session** | `madi-session.js` `madi-iep.js` | 세션 기록, IEP |
| **home** | `madi-home.js` `madi-dashboard.js` | 홈·네비·대시보드 |
| **child-mgmt** | `madi-children.js` `madi-child-detail.js` `madi-growth.js` | 아동 관리·상세·성장기록 |
| **ai** | `madi-ai.js` `madi-assessment.js` | AI 리포트·IEP, 표준화검사 |
| **calendar** | `madi-schedule.js` `madi-quick.js` | 스케줄·캘린더, 빠른 기록 |
| **system** | `madi-system.js` `madi-chat.js` | PWA·권한·초기화, AI 비서 마로 |
| **report** | `madi-report.js` | 리포트·장단기계획 |
| **board** | `madi-board-notice.js` `madi-board.js` | 공지·라운지·자료실 |
| **parent** | `madi-parent.js` `madi-parent-home.js` `madi-parent-pages.js` | 학부모 포털 전체 |
| **edge** | `supabase/functions/ai-proxy/index.ts` `supabase/functions/api/index.ts` `supabase/functions/change-password/index.ts` `supabase/functions/login/index.ts` `supabase/functions/notify-test/index.ts` `supabase/functions/notify-tomorrow/index.ts` `supabase/functions/parent-auth/index.ts` `supabase/functions/totp/index.ts` `supabase/functions/upload-image/index.ts` `supabase/functions/_shared/auth.ts` | Edge Functions (클라이언트와 완전 격리) |
| **static** | `sw.js` `index.html` `admin.html` `madi.css` | 정적 자산·PWA·공통 HTML |

---

## 에이전트 역할 전문화

도메인 분리 외에 **역할 기반 분리**를 기능 구현 시 추가 적용한다.

| 역할 | 모델 | 수 | 책임 |
|------|------|---|------|
| **Architect** | opus | 1 | 설계·인터페이스 정의, 구현 명세 작성 |
| **Implementer** | sonnet | N | 도메인별 실제 코드 작성 |
| **Reviewer** | sonnet | 1 | 구현 결과 교차 검증, 누락·충돌 탐지 |

### 역할 분리 흐름

```
Architect (opus) 완료
  → 구현 명세 산출물 생성 (각 Implementer 브리핑에 첨부)
  → Implementer × N 동시 spawn
  → 모두 완료 후 Reviewer spawn (전체 결과 취합해 교차 검증)
  → 이상 없으면 통합 커밋
```

### Architect 브리핑 추가 항목

```
[Architect] 기능 설계 에이전트

기능 요구사항: [요구사항]

출력할 것 (Implementer 브리핑에 그대로 첨부):
1. 도메인별 변경 파일 목록
2. 각 파일에서 추가/수정할 함수명 + 시그니처
3. 도메인 간 인터페이스 (전역 변수명, 함수 호출 관계)
4. 구현 순서 의존관계 (순차 필요한 것 명시)

코드 작성 금지 — 설계 명세만 출력.
```

### Reviewer 브리핑 추가 항목

```
[Reviewer] 구현 검증 에이전트

아래는 각 Implementer의 구현 결과다:
[각 에이전트 완료 결과 붙여넣기]

검토할 것:
1. Architect 명세와 실제 구현 불일치 (함수명, 시그니처, 전역 변수)
2. 도메인 간 인터페이스 연결 누락 (A 에이전트가 만든 함수를 B가 호출하는지)
3. 중복 구현 (같은 기능을 두 에이전트가 각자 만든 경우)
4. 파티션 규칙 위반 (담당 외 파일 수정 여부)

문제 발견 시: [파일명:줄] — [문제 설명] — [수정 방법] 형식으로 보고.
이상 없으면 "✅ 통합 이상 없음" 한 줄 출력.
```

---

## 도메인별 E2E 테스트 매핑

수정 완료 후 **어떤 테스트를 실행할지** 도메인에 따라 결정한다.

| 수정 도메인 | 실행 테스트 | 명령 |
|------------|-----------|------|
| core | auth.spec.js 전체 | `npx playwright test auth` |
| session | forms.spec.js > 세션 기록 폼 | `npx playwright test forms` |
| calendar | buttons.spec.js > 캘린더 탭, navigation.spec.js > 내보내기 | `npx playwright test buttons navigation` |
| child-mgmt | buttons.spec.js > 아동 탭, forms.spec.js > 아동 추가 | `npx playwright test buttons forms` |
| ai | forms.spec.js > AI 언어평가보고서 폼 | `npx playwright test forms` |
| board | buttons.spec.js > 게시판 탭, navigation.spec.js > 게시판 | `npx playwright test buttons navigation` |
| system, home | buttons.spec.js > 헤더·보고서 탭 | `npx playwright test buttons` |
| **2개 이상 도메인** | **전체 44개** | `npx playwright test` |

> **환경 변수 필수**: `$env:TEST_USERNAME` · `$env:TEST_PASSWORD` — 실제 값은 로컬에서 직접 설정 (이 파일에 기록 금지 — 공개 repo 노출 위험)

---

## 하네스 패턴 10종

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

프로젝트 경로: (현재 작업 디렉토리 — 에이전트 spawn 시 `pwd` 결과 삽입)
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
예) [CRASH] madi-ai.js:92 — downloadPDF() — window.open() null 체크 없음

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

프로젝트 경로: (현재 작업 디렉토리 — 에이전트 spawn 시 `pwd` 결과 삽입)
담당 파일: [파일1], [파일2], ...

수정 목록:
- [파일명] 줄 ~: [무엇을 어떻게 — 구체적인 수정 방법 명시]
- [파일명] 줄 ~: [...]

코딩 규칙 (반드시 준수):
- var / function / .then() 스타일 유지 — let / const / 화살표함수 / class 미사용
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

프로젝트 경로: (현재 작업 디렉토리 — 에이전트 spawn 시 `pwd` 결과 삽입)
담당 파일: [파일 목록]

기능 명세:
[요구사항 — 어떤 데이터, 어떤 UI, 어떤 동작]

선행 에이전트 완료 내용 (있는 경우):
[다른 에이전트가 이미 처리한 부분 요약]

이 에이전트가 구현할 내용:
- [변경 항목 1]
- [변경 항목 2]

코딩 규칙: var / function / .then() 스타일 유지 — let/const/화살표함수 미사용
완료 후 commit 하지 말 것 (통합 단계에서 일괄 처리).

완료 보고 형식 (Reviewer가 취합할 수 있도록 반드시 이 형식으로 출력):
✅ [도메인명] 구현 완료
- [파일명]: [추가/수정한 함수명] — [한 줄 설명]
- [파일명]: [추가/수정한 함수명] — [한 줄 설명]
⚠️ 미구현 항목 (있는 경우): [항목명] — [이유]
```

**기능 하네스 역할 분리 예시**:
```
새 기능 X 추가 시:
├── core 에이전트    → 공통 유틸 함수·상수 추가 (madi-core.js)
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

프로젝트 경로: (현재 작업 디렉토리 — 에이전트 spawn 시 `pwd` 결과 삽입)

목표: 아래 질문/작업의 영향 범위를 파악해서 "어느 도메인 에이전트를 실행해야 하는지" 결정한다.

작업 내용:
[사용자 요청 또는 변경 내역 한 줄 설명]

수행할 것:
1. `git diff HEAD~1 --name-only` 또는 관련 키워드로 최근 변경 파일 확인
2. ⚠️ core 파일(madi-core.js, madi-auth.js, madi-app.js, madi-vocab.js) 변경 여부 먼저 확인:
   → core 변경 감지 시: 전역 스코프로 모든 도메인이 의존하므로 **전체 12개 도메인 모두 실행 필요**로 즉시 결론 내고 3번 스킵
3. 변경 파일을 아래 파티션 테이블에 매핑 (core 변경 없을 때만):
   core: madi-core.js, madi-auth.js, madi-app.js, madi-vocab.js
   session: madi-session.js, madi-iep.js
   home: madi-home.js, madi-dashboard.js
   child-mgmt: madi-children.js, madi-child-detail.js, madi-growth.js
   ai: madi-ai.js, madi-assessment.js
   calendar: madi-schedule.js, madi-quick.js
   system: madi-system.js, madi-chat.js
   report: madi-report.js
   board: madi-board-notice.js, madi-board.js
   parent: madi-parent.js, madi-parent-home.js, madi-parent-pages.js
   edge: supabase/functions/ai-proxy, api, change-password, login, notify-test, notify-tomorrow, parent-auth, totp, upload-image, _shared/auth.ts
   static: sw.js, index.html, admin.html, madi.css
4. 영향 도메인 목록과 이유를 한 줄씩 출력
5. "실행 불필요" 도메인은 명시적으로 제외 이유 작성

출력 형식:
✅ 실행 필요: board (madi-board-notice.js 변경), ai (madi-ai.js 변경)
⏭️ 스킵: core, session, home, child-mgmt, calendar, system, report, parent, edge, static — 변경 없음

core 변경 시 출력 형식:
⚠️ core 변경 감지 (madi-core.js) → 전체 12개 도메인 실행 필요
✅ 실행 필요: core, session, home, child-mgmt, ai, calendar, system, report, board, parent, edge, static
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
  명령: $env:TEST_USERNAME=[계정]; $env:TEST_PASSWORD=[비밀번호]; npx playwright test [관련 spec]
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

**실패 시 처리 — 핫픽스 우선, 롤백은 최후 수단**:

```
Step A — 원인 파악
  스크린샷·에러 메시지로 실패 테스트와 관련 도메인 식별

Step B — 핫픽스 시도 (권장)
  해당 도메인 에이전트 재spawn → 수정 커밋 push → 재Sentinel
  (GitHub Pages 배포 1~2분 대기 후 재실행)

Step C — 롤백 (핫픽스 실패 시)
  ✅ 사용: git revert [커밋해시]  → 새 커밋으로 되돌림 (히스토리 보존)
  ❌ 금지: git reset --hard       → push된 커밋에 사용 금지
  ❌ 금지: git push --force       → 협업 환경에서 히스토리 파괴

  revert 대상 확인:
    git log --oneline -5          → 최근 커밋 해시 확인
    git revert [해시] --no-edit   → 자동 revert 커밋 생성
    git push origin main

Step D — 보고
  핫픽스·롤백 모두 2회 실패 시:
  대장님께 아래 정보와 함께 즉시 보고:
  - 실패 테스트명 + 스크린샷
  - 관련 커밋 해시 목록
  - 시도한 수정 내용 요약
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

### 8. Git Worktree 격리 패턴

**트리거**: 병렬 에이전트 3개 이상 + core 포함 수정 또는 index.html 동시 수정

**목적**: 파일 단독 소유를 "규칙"이 아닌 물리적 격리로 보장.
같은 worktree에서 병렬 작업 시 에이전트 실수 한 번으로 충돌 발생 → worktree 분리로 원천 차단.

**실행 절차**:

```powershell
# 1. 각 에이전트마다 별도 worktree 생성 (에이전트 spawn 전)
git worktree add .claude/worktrees/agent-[도메인] -b wt/[도메인]

# 2. 에이전트 브리핑에 worktree 경로 명시
#    프로젝트 경로: (현재 작업 디렉토리)/.claude/worktrees/agent-[도메인]

# 3. 모든 에이전트 완료 후 main에 순차 병합 (순서 중요)
#    core 변경 포함 시: core → static → 나머지 도메인 순서로 병합
#    core 미포함 시: 완료된 순서대로 병합 가능
git merge wt/[도메인] --no-ff -m "merge: [도메인] 에이전트 결과"

# 4. worktree 정리
git worktree remove .claude/worktrees/agent-[도메인]
git branch -d wt/[도메인]
```

**적용 기준**:

| 상황 | worktree 격리 |
|------|-------------|
| 에이전트 1~2개, 독립 도메인 | 불필요 |
| 에이전트 3개 이상, core 미포함 | 선택 (파티션 테이블 준수 시 생략 가능) |
| core 포함 수정 | **필수** |
| index.html + JS 파일 동시 수정 | **필수** |
| 기능 구현 하네스 (Architect+Implementer) | **필수** |

> **참고**: sw.js 캐시 버전은 pre-commit 훅이 자동 갱신 — worktree 병합 후 수동 처리 불필요.

---

### 9. 컨텍스트 스냅샷 패턴

**트리거**: 에이전트 6개 이상 운영 또는 30분 이상 소요 예상 작업 (전체 감사, 대형 기능 구현)

**목적**: 대화가 길어지면 컨텍스트 압축이 발생해 에이전트 결과가 유실됨.
웨이브 완료마다 결과를 파일로 저장해 대화 재시작 후에도 이어서 진행 가능하게 함.

**스냅샷 파일 경로**: `.claude/snapshot-{YYYYMMDD-HH}.md`

**스냅샷 내용 구조**:

```markdown
# 작업 스냅샷 — {날짜-시간}

## 작업 목표
[사용자 요청 한 줄 요약]

## 진행 상태
- [x] core 도메인 (완료)
- [x] board 도메인 (완료)
- [ ] ai 도메인 (미완료)
- [ ] parent 도메인 (미완료)

## 완료 에이전트 결과 요약
### board
- madi-board-notice.js:45 — [CRASH] null 체크 수정 완료
- madi-board.js:120 — [XSS] escHtml 적용 완료

## 미처리 항목
- ai: madi-ai.js:92 — [CRASH] window.open null 체크 필요

## 다음 웨이브
ai, parent 에이전트 spawn 예정
```

**운영 규칙**:
- **저장 시점**: 각 웨이브 완료 직후, 다음 웨이브 spawn 전
- **재개 방법**: 대화 재시작 시 스냅샷 Read → 미완료 항목부터 재실행
- **정리**: 전체 작업 완료 + 커밋 후 스냅샷 파일 삭제 (git 커밋에 포함 금지)
- `.gitignore`에 `.claude/snapshot-*.md` 추가 권장

---

### 10. Post-Work Auto-Verify 패턴

**트리거**: JS 파일 변경이 포함된 **모든 코드 수정 작업 완료 후 자동**

**목적**: 수정 직후 회귀(regression)를 즉시 탐지. 대장님이 앱을 직접 열어 확인하지 않아도 됨.

**구현 레이어 (3단계)**:

```
Layer 1 — Stop 훅 (자동, 즉시)
  Claude 응답 완료 시 madi-*.js 변경 감지 → ESLint + Smoke 자동 실행 (~5초)

Layer 2 — PostToolUse 훅 (자동, 파일 저장마다)
  Edit/Write 실행 직후 → node --check (문법) → 현재 활성

Layer 3 — Post-Verify Agent (작업 완료 선언 시, 수동 트리거)
  대형 작업(파일 5개+) 완료 시 spawn → sentinel 포함 전체 검증
```

**Layer 1 동작 흐름**:

```
Claude Stop
  └─ git diff --name-only HEAD | grep madi-*.js
       ├─ 변경 없음 → 점검 생략
       └─ 변경 있음 → ESLint → Smoke → 결과 출력
                          │           │
                        오류 발견   실패 발견
                          └─────┬────┘
                          Claude 재수정 → 재커밋
```

**Layer 3 — Post-Verify Agent 브리핑 템플릿**:

```
역할: Post-Verify Agent (검증 전담)
작업: 방금 완료된 코드 수정에 대한 전체 검증

수행 순서:
1. npm run lint                          → ESLint 오류 0개 확인
2. node tests/smoke.js                   → 23/23 통과 확인
3. npx playwright test --project=sentinel → 라이브 3개 통과 확인

실패 시: 실패 항목과 파일명:라인번호를 보고. 직접 수정하지 말고 보고만 할 것.
성공 시: "✅ 전체 검증 통과 — 배포 안전" 한 줄만 출력.
```

**자동 트리거 조건**:

| 조건 | 동작 |
|------|------|
| JS 파일 1~4개 변경 | Layer 1만 (Stop 훅 자동) |
| JS 파일 5개 이상 변경 | Layer 1 + Layer 3 (Post-Verify Agent spawn) |
| Edge Function 변경 | Layer 1 + 배포 후 sentinel 재실행 |

**CLAUDE.md 연동 규칙**:
- Layer 1은 훅으로 자동 실행 — 별도 지시 불필요
- Layer 3은 대형 작업(5파일+) 완료 후 Claude가 자동으로 spawn_task 호출
- 검증 실패 시 커밋·푸시 전 재수정 (Fix-Verify Loop와 동일 원칙)

---

## 에이전트 실패 에스컬레이션 트리

실패 유형별 대응을 명확히 분기한다. "2회 실패 시 보고"보다 구체적으로.

| 실패 유형 | 1차 대응 | 2차 대응 (1차 실패 시) |
|----------|---------|-------------------|
| ESLint 실패 | 해당 파일 도메인 에이전트 재spawn (오류 메시지 첨부) | core 에이전트에 전달 후 재검토 |
| Smoke 테스트 실패 | core 에이전트 단독 재실행 | 대장님께 보고 후 중단 |
| E2E 1~3개 실패 | 해당 도메인 에이전트 재spawn (스크린샷 + 오류 첨부) | Pre-Scout 재실행 → 범위 재확인 |
| E2E 전체 실패 | git diff로 core 변경 확인 → core 에이전트 재실행 | git revert 검토 후 대장님께 보고 |
| Sentinel 실패 | 핫픽스 에이전트 spawn → 재push → 재Sentinel | git revert → push → 재Sentinel |
| 에이전트 무응답 | 동일 브리핑으로 1회 재실행 | 에이전트 없이 직접 처리 |
| worktree 병합 충돌 | 충돌 파일 확인 → static 에이전트에 수동 해결 위임 | 대장님께 보고 후 중단 |

### 롤백 원칙

```
✅ 사용:  git revert [해시] --no-edit  → 새 커밋으로 되돌림 (히스토리 보존)
❌ 금지:  git reset --hard             → push된 커밋에 사용 금지
❌ 금지:  git push --force             → 원격 히스토리 파괴
```

### 에스컬레이션 한도

- 동일 실패가 **누적 2회** → 즉시 중단, 대장님께 아래 정보 보고:
  1. 실패 테스트명 + 스크린샷
  2. 관련 커밋 해시 목록
  3. 시도한 수정 내용 요약
  4. 재시도 권장 방법 (있는 경우)

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
core       : madi-core.js, madi-auth.js, madi-app.js, madi-vocab.js
session    : madi-session.js, madi-iep.js
home       : madi-home.js, madi-dashboard.js
child-mgmt : madi-children.js, madi-child-detail.js, madi-growth.js
ai         : madi-ai.js, madi-assessment.js
calendar   : madi-schedule.js, madi-quick.js
system     : madi-system.js, madi-chat.js
report     : madi-report.js
board      : madi-board-notice.js, madi-board.js
parent     : madi-parent.js, madi-parent-home.js, madi-parent-pages.js
edge       : supabase/functions/ai-proxy/index.ts
             supabase/functions/api/index.ts
             supabase/functions/change-password/index.ts
             supabase/functions/login/index.ts
             supabase/functions/notify-test/index.ts
             supabase/functions/notify-tomorrow/index.ts
             supabase/functions/parent-auth/index.ts
             supabase/functions/totp/index.ts
             supabase/functions/upload-image/index.ts
             supabase/functions/_shared/auth.ts
static     : sw.js, index.html, admin.html, madi.css
```
