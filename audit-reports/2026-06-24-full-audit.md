# 전수감사 리포트 (2026-06-24)

**발견 요약**: CRITICAL 0건, HIGH 22건(실질 위험 6건), MEDIUM 38건, LOW 31건, INFO 29건 | 서버 보안 모범적, 클라이언트 XSS·에러로깅·다크모드 위생 개선 필요 | 베타 출시 가능 수준(종합 건강도 78/100)

---

## 전체 요약

대장님, 9개 정적 도메인과 라이브 프로브 1건을 종합한 결과를 보고드립니다.

| 심각도 | 건수 | 비중 |
|--------|------|------|
| CRITICAL | **0** | — |
| HIGH | **22** | 즉시 조치 대상 |
| MEDIUM | **38** | 다음 스프린트 |
| LOW | **31** | 점진 개선 |
| INFO | **29** | 확인 완료/현행 유지 |
| **합계** | **120** | |

도메인별 분포:

| 도메인 | C | H | M | L | I |
|--------|---|---|---|---|---|
| 보안 감사 (madi-app) | 0 | 3 | 4 | 3 | 3 |
| DB 스키마 정합성 | 0 | 2 | 3 | 2 | 2 |
| 코딩 컨벤션 | 0 | 1 | 1 | 4 | 5 |
| 역할·권한 분기 | 0 | 3 | 4 | 3 | 3 |
| 에러 핸들링 | 0 | 4 | 8 | 6 | 3 |
| 성능·중복 | 0 | 3 | 6 | 4 | 2 |
| UI/UX | 0 | 4 | 6 | 4 | 2 |
| Edge Function 보안 | 0 | 1 | 3 | 3 | 4 |
| PWA/SW/IndexedDB | 0 | 1 | 3 | 2 | 4 |
| 라이브 프로브 | 0 | 0 | 0 | 0 | 1 |

**핵심 판정**: CRITICAL 0건. 시스템은 구조적으로 견고하며 서버(Edge Function) 보안·인증·service_role 격리는 모범적입니다. 다만 **즉시 조치가 필요한 항목은 HIGH 22건 중 실질 위험을 가진 6건**(XSS 3건 + ID 정밀도 손실 1건 + 권한 fail-closed 누락 1건 + 비밀번호 4자 1건)으로 압축됩니다. 나머지 HIGH는 로깅 누락·UI 다크모드·코드 일관성 등 위험도가 낮은 항목입니다.

---

## 1. CRITICAL (즉시 수정 필수)

**해당 없음.** 데이터 유실·서버 권한 에스컬레이션·즉시 악용 가능한 원격 코드 실행 등 CRITICAL 등급 결함은 발견되지 않았습니다.

---

## 2. HIGH (이번 스프린트 내 수정)

### 그룹 A — 저장형 XSS (jsArg 미적용) — 최우선

CLAUDE.md 보안 불변식 직접 위반. 사용자가 설정 가능한 이름 값에 작은따옴표가 들어가면 JS 문자열 탈출이 가능합니다.

1. **[admin.html:2643]** `selectParentChild` onclick에 `c.name`/`c.id`/`c.center_id`를 `escHtml`만 적용해 삽입. admin.html에는 `jsArg` 함수 자체가 정의되어 있지 않음 → **jsArg 함수 추가(또는 madi-core.js 로드) 후 세 인자 전부 `jsArg()` 래핑**, 또는 data-action 위임 전환.
2. **[admin.html:2769]** `deleteParentAccount` onclick에 `r.name||r.username`을 `escHtml`만 적용. 학부모 이름은 사용자 설정 가능 → **`jsArg(r.name)` 래핑**, `r.id`도 String 변환 후 처리.
3. **[madi-assessment.js:1059-1060]** `downloadAssessPDF` onclick에 `cn = escHtml(child.name)` 사용 → **`var cn = jsArg(child.name);` 로 교체**.

### 그룹 B — DB 정합성

4. **[madi-app.js:80, 81, 146]** `madi_schedules`·`madi_assessments` 로드 시 `select=id,data`로 numeric PK를 JS number 수신 → 2^53 초과 시 정밀도 손실, ID 매칭(`id===id`) 실패. sessions는 `id::text`로 수정된 선례(2026-06-09)가 있으나 schedules/assessments는 누락 → **`select=id::text,data`로 변경** (`_bpSch`, `_bpAs`, `_loadOlderHistory` 두 곳 모두). LOW로 분류된 madi-session.js:698 orphan 삭제 ID 혼재 문제도 이 수정으로 자동 해소.
5. **[admin.html:2927-3078]** `madi_licenses` 테이블 존재 미확인 상태에서 POST/GET/PATCH 호출. 테이블/컬럼 부재 시 라이선스 발급·목록·활성화 전체가 400/404 실패 → **admin 계정으로 테이블 실측 확인 후 SCHEMA.md 등재**, 부재 시 마이그레이션 실행 또는 UI 비활성화.

### 그룹 C — 권한 fail-closed

6. **[madi-iep.js:11, 65]** `saveSession`/`saveSessionAI`이 `role==='parent'` 블랙리스트만 차단. `currentUser=null`·알 수 없는 role에 fail-safe 없음. `saveSessionAI`는 `canDo('useAI')`만 체크해 콘솔 우회 시 경로 노출 → **`if (!currentUser || !isStaffRole(currentUser.role)) { showToast('권한 없음'); return; }` 화이트리스트 가드 추가**.
7. **[madi-core.js:70-84]** `viewOtherChildren`가 클라이언트 UI 필터(canDo)일 뿐 서버 강제 부재. 같은 센터 teacher가 API 직접 호출 시 센터 내 전 아동 PII 조회 가능(M-1 기인지 이슈) → **`madi_children`에 `assigned_teacher_id` 컬럼 신설 + Edge Function teacher 스코프 필터**. 단기 완화: Edge에서 teacher 요청 시 scheduleDB/sessionDB 기반 child_id 목록을 서버 계산해 필터.

### 그룹 D — 에러 핸들링 (사용자 오정보·추적 불가)

8. **[madi-parent-home.js:699-703]** 바우처 사용 횟수 조회 실패 시 `_parentVoucherUsed=0` 폴백 → 학부모에게 '0회 이용' 오정보 표시 → **null 유지 후 '조회 실패'/'--' 플레이스홀더 표시**.
9. **[madi-assessment.js:1043-1063]** callClaude 체인이 then→then→catch 구조라 첫 then 예외 시 버튼 리셋 중복·스피너 잔존 → **resetBtn() 헬퍼를 then/catch 양쪽에서 호출**(madi-ai.js generateReport 패턴 차용).
10. **[madi-home.js:762-770]** `addNotice` catch가 원본 에러를 console에 기록하지 않음 → **`catch(function(e){ console.warn 추가 })`**.
11. **[madi-board.js:104-107]** `loadLoungeBoard` catch가 토스트+인라인 에러 중복 표시, 원본 에러 미기록 → **노출은 하나만, console.warn 추가**.

### 그룹 E — 성능·중복

12. **[madi-home.js:517-598]** `switchTab(2/3)`이 `populateChildSelects()`를 호출하고 직후 `switchReportTab`/`switchPortfolioTab`이 또 호출 → 수백 옵션 innerHTML 전체 교체 2배 → **서브탭 함수에서만 1회 호출하도록 통일**.
13. **[madi-home.js:157 / madi-schedule.js:237]** `loadStaffMgmtList`·`loadTeacherList`가 동일 데이터를 별도 인메모리 변수로 관리 → stale 위험 → **`_teacherList` 전역 SSOT 격상, fetch 경로 완전 동일화로 캐시 공유 강제**.
14. **[madi-schedule.js:920-928]** `execSchedDeleteChoice`(네 클릭)가 `window._delEsc` keydown 리스너를 removeEventListener하지 않음 → 다음 호출 시 중복 등록 누적 → **`ol2.remove()` 직후 `removeEventListener` + `window._delEsc=null`**.

### 그룹 F — UI/UX (다크모드 하드코딩·터치 타겟)

15. **[madi-app.js:651-666]** 학부모 사이드바가 `background:white`·`#64748b` 인라인 하드코딩 → 다크모드 흰 배경 고정, WCAG AA 대비 미달 가능 → **CSS 변수(`var(--card-bg)`/`var(--border)`/`var(--text2)`)로 교체, 가능하면 인라인 제거하고 #parentSidebar CSS 클래스 활용**.
16. **[madi-dashboard.js:784-799]** Admin '빠른 액션' 4개 아바타 파스텔 배경 인라인 하드코딩 → 다크모드 미적용 → **`dp-kic-amber/blue/green/purple` 클래스 활용(인라인만 제거)**.
17. **[madi-parent-home.js:142]** 다자녀 셀렉터 탭 `min-height:40px` → WCAG 2.5.5/HIG 44px 미달 → **`min-height:44px` + padding 상향**.
18. **[madi-dashboard.js:531, 537]** 미작성 강조·superadmin 집계 라벨 span이 `#a16207`/`#d97706` 인라인 → 다크모드 재정의 미적용 → **클래스/`var(--amber)` 토큰 사용**.

### 그룹 G — Edge Function 보안

19. **[change-password:82 / parent-auth:297]** 비밀번호 최소 길이 4자(베타 임시 완화, 주석엔 '정식 8자'). bcrypt cost=12가 보호막이나 해시 유출 시 4자 공간은 현실 위협 → **`< 4`를 `< 8`로, 에러 메시지 동기 수정**. (정식 배포 게이트 항목)

### 그룹 H — PWA

20. **[madi-deploy.js:82-193]** 인라인 폴백 SW(`SW_LINES`)가 sw.js 손사본이며, 인앱 배포(deployToGitHub)는 git pre-commit 훅을 거치지 않아 폴백 경로 드리프트 위험. `SW_BUILD` 타임스탐프는 모듈 로드 시점 1회 계산 → 탭 장시간 유지 시 stale → **인앱 배포는 항상 폴더의 실제 sw.js 직접 읽기, 폴백 사용 시 경고 토스트, 타임스탐프 계산을 배포 호출 시점으로 이동**.

### 권한 설계 불일치 (HIGH — 보안 영향 낮으나 문서화/정정 필요)

21. **[madi-quick.js:86]** `openQuickPanel`/`quickSave`가 `role !== 'teacher'` 차단 → admin/superadmin도 차단됨. 함수 내부 가드라 보안 문제는 아니나 역할 설계 불일치 → **teacher 전용이 의도면 주석/CLAUDE.md 명시, admin도 허용해야 하면 `!isStaffRole()`로 변경**.
22. (그룹 C #6 viewOtherChildren는 권한 도메인·보안 도메인·역할 도메인 3개에서 중복 식별 — 동일 이슈로 1건 처리)

---

## 3. MEDIUM (다음 스프린트)

**보안/스키마**
- [madi-parent.js:71-76] postSessionBriefing actions를 escHtml 없이 innerHTML 삽입 (현재 하드코딩, 향후 외부소스 시 XSS)
- [madi-auth.js:137, 187] currentUser(role 포함) localStorage 평문 저장 (서버 JWT 검증 구조라 위험 낮음)
- [madi-ai.js:218] markdownToHtml AI 응답을 document.write 렌더 — PDF 팝업에 CSP 메타 또는 Blob+iframe 샌드박스 권장
- [madi-child-detail.js:401 / madi-home.js:205 / madi-system.js:106] audit_log POST body를 배열 아닌 plain object — `[payload]`로 통일(board.js:1002 선례)
- [madi-parent-home.js:411] 2차 필터에서 존재하지 않는 컬럼 `a.child_id` 참조(항상 undefined) — 제거
- [madi-core.js:507-520] `_reportClientError` audit_log payload 단일 object — `body:[payload]`로 래핑 권장

**권한**
- [madi-board.js:250, 429] saveComment 블랙리스트 방어 — `isStaffRole()` 화이트리스트로 전환
- [madi-board.js:664-667] saveLibraryPost에 center_id 가드 부재 — `if(!currentUser.center_id) return` 추가
- [madi-home.js:447-449] admin 전용 탭 가드에 안내 토스트 부재 (이중 방어는 이미 존재)
- [madi-home.js:334, 364] 레거시 대시보드 역할 분기 순서 파일마다 상이 — ROLES 상수/헬퍼로 통일

**에러 핸들링** (대부분 catch 에러 인자 누락 → console.warn 미기록)
- madi-parent-pages.js:51, 181, 784 / madi-parent-home.js:352-356 / madi-parent.js:583, 598-600 / madi-session.js:745 / madi-system.js:63-65 — 모두 에러 인자 추가 + console.warn 로깅

**성능**
- [madi-growth.js:749-755] populateChildSelects 호출마다 onchange 재할당+즉시 loadGoalRows — 바인딩 가드 추가
- [madi-app.js:128-131] 30초 폴링에서 보조 fetch 3종 무조건 실행 — 메인 컬렉션 시그니처 변화 시에만 트리거
- [madi-schedule.js:552-588] renderSessionListForPeriod O(날짜×일정) — date→sessions 룩업 맵으로 교체
- [madi-child-detail.js:87-97] getLastSessionForChild O(N) filter+sort — 맵 사전 구축 또는 정렬 가정으로 sort 생략
- [madi-children.js:562-587] 종결 통계 list vs visibleList 혼용 위험 — 변수명/주석 명확화

**UI/UX**
- [madi-dashboard.js:196, 352, 538, 673-674] freshness/범례 dot 색상 인라인 — `var(--text2)`/다크모드 대비 확보
- [madi-parent-home.js:647, 651] 바우처/예약 헤딩 색상 인라인 — `var(--text2)`
- [madi-dashboard.js:573-583] 선생님 활동표 로딩 시 스피너 부재 — loading 클래스/스피너 적용
- [madi-parent-home.js:160-236] 4개 병렬 fetch 중 섹션별 로딩 표시 불일치 — 각 섹션 스피너 선삽입

**Edge/PWA**
- [_shared/auth.ts:24] allowNullOrigin 주석 오기 (login/api 실제 false) — 주석 정정
- [github-deploy/index.ts:35] '(null Origin 허용)' 주석 오기 (실제 거부, 동작은 올바름) — 주석 정정
- [notify-tomorrow/index.ts:74-81] CRON_SECRET 미설정 시 503 — Dashboard에서 실제 설정 확인 + 모니터링
- [madi-system.js:319-332] SW 자동 reload dirty 체크가 visible textarea만 의존 — input 필드/저장 플래그 포함
- [madi-parent-pages.js:629-647] 푸시 unsubscribe 실패 시 서버/브라우저 불일치 방치 — catch에서도 loadParentPushToggle 호출
- [madi-deploy.js:365-367] 배포 SHA를 localStorage 신뢰 — 공유 기기 시 오판 (확인 다이얼로그 존재로 비치명적)

---

## 4. LOW / INFO

**LOW (31건 요약)**
- 컨벤션: madi-app.js:249 console.warn 가드 누락 / madi-growth.js:367·madi-board-notice.js:150,168 jsArg 대신 escHtml(하드코딩/정수라 무해) / madi-assessment.js:309 LANGSOLVE_NORMS dead 선언
- 에러: madi-session.js:128 JSON.parse try-catch 누락 / madi-auth.js:360·madi-parent-pages.js:645 빈 catch 주석 부재 / madi-home.js:769, 850-851 _userErrMsg 미사용
- 성능: madi-system.js:342 SW update setInterval clearInterval 부재 / madi-app.js:564-575 startHeaderClock 호출 경로 확인 / madi-schedule.js:333-343 weekViewToggle innerHTML 전체 교체 / madi-home.js:698-703 loadNotices limit=50 초과 누락
- UI: madi-quick.js:403-406 토글 슬라이더 `#cbd5e1`·453 체크박스 18px 터치 / madi-dashboard.js:832,838·madi-parent-home.js:289-291 `#94a3b8` 인라인
- Edge: totp:88-107 requireFreshSession 미사용 인라인 / logout:36-37 rate limit fail-open / parent-auth:44-97 checkRateLimit 로컬 재구현
- 스키마: madi-board.js:693 images JSON.stringify 타입 미확정 / madi-session.js:698 (HIGH #4 수정 시 해소)
- 보안: madi-core.js:147,155 SUPA/EDGE URL 하드코딩(정적 사이트 불가피) / madi-session.js:131 error_log sessionStorage
- PWA: manifest.json:16-24 icon-1024 미등록

**INFO (29건 — 확인 완료/현행 유지)**
- 보안: canDo() fail-closed 올바름 / JWT 인메모리+sessionStorage 폴백 설계 양호 / Anthropic 키 클라 노출 폐지 완료(H-1)
- Edge: verifyJwt alg:none 차단·exp 필수 일관 / service_role+자체 필터 / 업스트림 에러 generic 래핑 — **모두 모범적**
- PWA: CACHE_NAME 자동 갱신·updateViaCache:none 견고 / offline.html 폴백 양호 / IndexedDB 3종 종료 경로+db.close() 모범 / Web Push origin 검증 양호
- 코드 중복(무해): madi-ai.js monthBlock×2·statCard / _isMine 동명 / _hashStr dead code
- 권한: admin.html 이중 인증·visibility:hidden 차단 양호 / parent 포털 parent_user_id 필터 안전

---

## 도메인별 건강도 점수 (100점 만점)

| 도메인 | 점수 | 평가 |
|--------|------|------|
| Edge Function 보안 | **92** | JWT·service_role·에러 래핑 모범적. 비밀번호 4자(베타) + 주석 오기만 남음 |
| PWA/SW/IndexedDB | **88** | 캐시 갱신·오프라인·IDB 처리 견고. 폴백 SW 드리프트 위험만 보강 필요 |
| DB 스키마 정합성 | **80** | ID::text 누락 1건·licenses 테이블 미확인이 실질 리스크. 나머지는 일관성 |
| 라이브 프로브 | **N/A** | 자격증명 미설정으로 미수행 — 실DB 정합성 미검증 (점수 산정 보류) |
| 코딩 컨벤션 | **78** | jsArg 1건 외 대부분 무해한 컨벤션 일탈·dead code. var/function 규약 준수 양호 |
| 보안 감사 (madi-app) | **75** | XSS 2건이 감점 핵심. 토큰·키 관리는 우수, 클라 입력 이스케이프 일부 누락 |
| 역할·권한 분기 | **74** | 서버 이중 방어는 견고하나 클라 fail-closed 누락·블랙리스트 방식·viewOtherChildren 서버 미강제 |
| 에러 핸들링 | **70** | catch 에러 인자 누락이 광범위(추적성 저하) + 바우처 0 폴백 오정보. 패턴 통일 시급 |
| 성능·중복 | **76** | populateChildSelects 중복·리스너 누수가 핵심. 대형 센터 월간 뷰 O(N²) 잠재 |
| UI/UX | **72** | 다크모드 인라인 하드코딩이 도메인 전반. 터치 타겟·로딩 표시 보강 필요 |

**종합 건강도: 약 78/100** — 베타 출시 가능 수준. 서버는 우수, 클라이언트 위생(이스케이프·에러로깅·다크모드 토큰)이 개선 여지.

---

## 권고 수정 순서 (로드맵)

### 1순위 — 이번 스프린트 (보안·데이터 정합성, 1~2일)
1. **XSS 3건** — admin.html:2643/2769에 jsArg 추가·적용, madi-assessment.js:1059 jsArg 교체
2. **ID 정밀도** — madi-app.js:80/81/146 `select=id::text,data` (sessions 선례 그대로)
3. **권한 fail-closed** — madi-iep.js saveSession/saveSessionAI에 `isStaffRole` 화이트리스트 가드
4. **바우처 오정보** — madi-parent-home.js:699 폴백 0 → null + '--' 표시
5. **비밀번호 8자** — change-password:82, parent-auth:297 (정식 배포 게이트, 베타 유지 여부 대장님 판단)
6. **madi_licenses 실측** — admin 계정으로 테이블 확인 → SCHEMA.md 등재

### 2순위 — 다음 스프린트 (안정성·성능, 2~3일)
7. **에러 로깅 일괄** — catch 에러 인자 + console.warn 12곳 (parent-pages/parent-home/parent/session/system/board/home)
8. **viewOtherChildren 서버 강제** — `assigned_teacher_id` 컬럼 + Edge teacher 스코프 (마이그레이션 필요, 단독 작업)
9. **성능 3건** — populateChildSelects 중복 제거(home.js), _delEsc 리스너 정리(schedule.js), renderSessionListForPeriod 룩업 맵
10. **audit_log body 배열 통일** — child-detail/home/system + _reportClientError

### 3순위 — 점진 개선 (위생·UI, 여유 시)
11. **다크모드 토큰화** — dashboard.js/parent-home.js/app.js/quick.js 인라인 색상 → CSS 변수 (5+ 파일이므로 Post-Verify Agent 권장)
12. **터치 타겟** — parent-home.js:142 / quick.js:453 44px 확보
13. **주석 정정·코드 정리** — Edge auth.ts:24·github-deploy:35 주석, dead code(LANGSOLVE_NORMS·_hashStr), monthBlock/statCard 통합
14. **라이브 프로브 실행** — `MADI_PROBE_USER=… MADI_PROBE_PW=… node tests/live-probe.js`로 실DB 정합성 보강 검증

---

## 잘 구현된 부분 (Keep)

1. **Edge Function 인증 체계 (모범)** — 전 함수가 자체 `verifyJwt`로 alg:none 차단·exp 필수화, `--no-verify-jwt` 독립 동작. service_role로 RLS 우회 후 함수 내부에서 역할·센터·소유권 필터를 직접 적용. anon key는 어디에도 노출 없음.
2. **토큰·키 관리** — JWT는 인메모리 + iOS ITP 대응 sessionStorage 폴백(localStorage 미저장). Anthropic API 키 클라이언트 노출 완전 폐지(H-1 완료). XSS 토큰 탈취 리스크 최소화.
3. **PWA 캐시 무결성** — pre-commit 훅의 CACHE_NAME 자동 타임스탬프 갱신 + `updateViaCache:'none'`, offline.html 폴백·lazy-prime, IndexedDB 3종 종료 경로 전부 `db.close()` 처리.
4. **권한 이중 방어** — admin.html이 1차(localStorage) + 2차(서버 Edge) 검증을 갖추고 2차 완료까지 `visibility:hidden`으로 UI 차단. 학부모 포털은 `parent_user_id` 기반 서버 필터로 교차 열람 차단.
5. **에러 정보 노출 통제** — api/ai-proxy/github-deploy가 업스트림 에러 원문을 클라이언트에 전달하지 않고 generic 메시지로 래핑, 원문은 서버 로그로만(`console.error`). 클라 측 `showError`/`_userErrMsg` 패턴과 일관.

---

## 추가 개선 제안

- **viewOtherChildren(M-1)**은 보안·역할·권한 3개 도메인에서 독립 식별된 유일한 구조적 PII 격리 결함입니다. `assigned_teacher_id` 마이그레이션은 단독 작업으로 분리해 신중히 진행하시길 권합니다(스키마 변경 + Edge + 클라 동시 수정).
- **라이브 프로브 미수행**으로 SCHEMA.md↔실DB 불일치(특히 madi_licenses·madi_lounge_posts.images 타입)는 이번 정적 감사로 확정할 수 없었습니다. 1순위 #6과 함께 자격증명 설정 후 프로브 1회 실행을 권합니다.
- **catch 에러 인자 누락**이 12곳에 걸쳐 동일 패턴으로 반복됩니다 — ESLint 커스텀 룰(`.catch(function() {`에서 빈 인자 경고)로 재발 방지를 자동화할 수 있습니다.
