# 전수감사 리포트 (2026-06-29)
**종합 평가**: 구조적 핵심 결함 3건(권한상승·CSP·cold-start env) + 보안 HIGH 21건을 제거하면 85+ 도달 가능, 현재 71/100.

# 아이마디 APP 전수점검 결과 리포트

## 전체 요약

| 심각도 | 건수 | 비중 |
|--------|------|------|
| 🔴 CRITICAL | 3 | 5.2% |
| 🟠 HIGH | 21 | 36.2% |
| 🟡 MEDIUM | 29 | 50.0%* |
| 🟢 LOW | 28 | — |
| ⚪ INFO | 27 | — |
| **총계** | **58건 (Critical~Medium 기준 53건 + Low/Info)** | |

> 9개 정적 도메인 + 라이브 프로브 1건. 라이브 프로브는 자격증명 미설정으로 **생략됨**(실DB↔SCHEMA.md 대조 미수행 — 후속 필요).

**즉시 조치 필요(CRITICAL + 보안 HIGH): 9건**
- 권한 상승 우회(클라 직접 INSERT), CSP unsafe-inline, Edge cold-start 환경변수, change-password permissions 누락이 핵심 축입니다.

---

## 1. CRITICAL (즉시 수정 필수)

### C-1. [madi-auth.js:110 / madi-home.js:126] 클라이언트 직접 INSERT로 권한 상승(Privilege Escalation)
회원가입·직원추가가 `supaFetch('madi_users', 'POST', [{role, permissions, ...}])`로 PostgREST에 직접 삽입됩니다. 클라이언트가 anon key로 직접 접근하면 주석상 "서버 teacher 강제"가 우회되어 `role: 'admin'` 임의 주입이 가능합니다. admin/superadmin 직접 추가 경로(madi-home.js)도 동일 패턴.
**→ 권고:** 회원가입·직원추가를 Edge Function(`/signup`, `/admin-add-user`)으로만 처리하고 서버가 role·permissions를 강제 설정. 클라이언트 페이로드에서 role/permissions 필드 제거. madi_users 직접 INSERT 허용 RLS 정책이 있으면 즉시 폐기.

### C-2. [index.html:24 / admin.html:24] CSP에 `'unsafe-inline'` 허용 (script-src + style-src)
XSS 성공 시 인라인 스크립트 무제한 실행 → CSP의 XSS 완화가 사실상 무력화. onclick 인라인 핸들러 226곳이 직접 원인.
**→ 권고:** 단기 — escHtml()/jsArg() 방어 철저 유지 + style-src의 unsafe-inline 우선 제거(인라인 스타일→CSS 클래스). 중장기 — onclick을 data-action 위임으로 이관 후 nonce 기반 CSP 전환.

### C-3. [supabase/functions/notify-tomorrow/index.ts:6-11] 모듈 최상위 env 읽기 → cold-start 인증 공백
`SUPABASE_SERVICE_ROLE_KEY` 등을 핸들러 밖(모듈 최상위)에서 읽어, Deno Deploy cold-start 시 env 미주입이면 빈 값으로 고정 → 이후 전체 요청이 인증 없이 호출되거나 학부모 push가 무조건 실패(가용성). 나머지 9개 함수는 모두 핸들러 내부에서 읽음 — 유일한 예외.
**→ 권고:** SUPA_URL/SUPA_KEY/VAPID_*/CRON_SECRET을 `Deno.serve()` 핸들러 내부 첫 줄로 이동. ai-proxy/login 패턴을 그대로 적용.

---

## 2. HIGH (이번 스프린트 내 수정)

### 보안 / Edge
- **[change-password/index.ts:131-140]** 비번 변경 후 재발급 JWT에 `permissions` 클레임 누락 → teacher가 비번 변경 직후 24시간 동안 viewOtherChildren(M-1) 격리 해제되는 보안 회귀. **→** `newPayload.permissions = user.permissions ?? {}` 추가.
- **[logout/change-password/ai-proxy/notify-test]** `allowNullOrigin: true`로 'null' Origin 허용 → file://·sandboxed iframe에서 SameSite=None 쿠키 자동첨부 cross-origin 공격(비번변경/AI비용/대량push). **→** 운영에서 allowNullOrigin 제거, localhost 허용으로 대체.
- **[madi-auth.js:134,185]** JWT를 sessionStorage('madi_sess')에 저장 → unsafe-inline CSP 하에서 XSS 시 토큰 탈취. **→** 인메모리 토큰 + httpOnly 쿠키 단독 인증 검토.
- **[madi-auth.js:187]** localStorage('madi_user')의 role/center_id 조작으로 클라 권한분기 우회. **→** 민감 작업 전 서버 재검증 라운드트립.
- **[madi-ai.js:218]** `document.write(markdownToHtml())` + eslint-disable로 검사 무력화 → escHtml↔정규식 순서 깨지면 XSS. **→** Blob URL/iframe sandbox로 교체, smoke 테스트 추가.

### 역할·권한
- **[admin.html:2138-2144]** removeStaffAccount()에 `center_id` 필터 누락 → madi-home.js(line 199)와 불일치, 타센터 삭제·감사추적 흐림. **→** center_id 필터 + 감사로그 추가.
- **[madi-quick.js:86-88]** openQuickPanel/quickSave가 admin/superadmin 차단, 거부 사유 불명확. **→** isStaffRole 허용 또는 명확한 안내 + CLAUDE.md 명문화.
- **[madi-home.js:333-334,363-364]** showServiceStats/renderUnwrittenAlert가 teacher 필터에 `currentUser.name` 문자열 비교 → 동명 교사 데이터 혼합. **→** teacher_id 우선 + 이름 폴백 패턴.

### DB 스키마
- **[madi-schedule.js:770]** `madi_schedules.child_id` 실컬럼 항상 NULL, notify-tomorrow가 이 컬럼(bigint) join → 학부모 알림이 조용히 0건 될 위험. **→** child_id 채우기(+::text 캐스팅) 또는 "죽은 컬럼" 명시 후 data->>childId 사용으로 통일.

### 코딩 컨벤션 (전역 충돌)
- **[madi-child-detail.js:474 / madi-dashboard.js:114]** `_isMine` 전역 중복 선언, 시그니처·로직 상이 → 로드 순서에 따라 의도와 다른 함수 호출. **→** `_isMyChild`/`_isMySession`로 분리.
- **[madi-ai.js:373,530]** `monthBlock` 동일 구현 복붙(renderIEP/renderIEPView) → 한쪽만 수정 사고. **→** 모듈 스코프 `_monthBlock` 헬퍼로 추출.

### 에러 핸들링
- **[madi-auth.js:360]** /logout 빈 catch — 보안 경로 실패 묵살. **→** console.warn + 클라 토큰·localStorage 정리 검증.
- **[madi-system.js:116]** savePermissions 감사로그 빈 catch — 감사 실패 무탐지. **→** console.warn 추가.
- **[madi-deploy.js:210]** 레거시 GitHub 토큰 정리 빈 catch — 구토큰 잔류. **→** console.warn 추가.

### 성능
- **[madi-app.js:117]** 30초 폴링마다 loadActivities/loadIEP/loadNotices 무조건 추가 fetch(폴링 1회당 3+ 요청). **→** _renderSkip 블록 내로 이동, notices 주기 분리.
- **[madi-home.js:157]** loadStaffMgmtList 캐시 의존 모호, 탭 전환마다 재호출. **→** 추가/삭제 직후 noCache+invalidate 패턴 통일.
- **[madi-children.js:562-566]** populateChildSelects 다중 탭 경로 중복 호출, 폴링 후 캐시 리셋 시 재렌더. **→** 동등성 조기 리턴.

### UI / 다크모드
- **[madi.css:2505-2508]** `.qc-diag` 다크모드 오버라이드 부재(저대비). **→** dark-mode 규칙 추가.
- **[admin.html:82,101,144,146]** form-input/select 화살표 SVG stroke #64748b가 다크 배경에서 안 보임. **→** stroke를 var(--text2) SVG로 교체.
- **[madi-dashboard.js:352,673-674,832,838]** JS 인라인 hex(#94a3b8/#0f3b66) 다크 미대응. **→** var(--text2)/var(--mint) 교체.
- **[madi-parent-home.js:289-291 외]** 학부모 홈 인라인 hex 다수 다크 미대응. **→** CSS 변수 일괄 교체.

### PWA
- **[madi-parent-pages.js:645]** 푸시 구독 실패 시 unsubscribe 후 loadParentPushToggle 이중 호출 + unsubscribe 실패 시 서버 무레코드인데 브라우저 구독 잔존(불일치). **→** then/catch 분리해 1회 갱신 + 실패 토스트.

---

## 3. MEDIUM (다음 스프린트)

**보안** — madi-parent-home.js:150 outerHTML eslint 일관성 / madi-ai.js AI응답 escHtml 의존(향후 DOMPurify) / madi-home.js:126 직원추가 서버 role 검증 / EDGE_URL 하드코딩

**Edge** — notify-tomorrow CORS+CRON_SECRET 강도 / parent-auth 자체 rate-limit 메모리 fallback(워커 분산 시 배수) / totp 인라인 세션검증(requireFreshSession 미사용)

**DB** — madi_lounge_posts images vs image_urls 혼용 / madi_assessments 로드 시 user_id 누락→폴링 재저장 시 소실

**역할** — madi-schedule.js:618 teacher 일정 생성 정책 불명확 / madi-board.js:250 superadmin UI우회 작성 / madi-home.js:447 switchTab idx5 admin 접근 / admin.html:2584 admin permissions PATCH 서버차단 교차검증

**코딩** — _onKey 전역 중복(auth/board) / safeGet·SetSessionItem·safeJsonParse 미사용 / close·doCancel 동명 클로저

**에러** — deleteNotice 로깅누락 / parent-home:198 UI피드백 없음 / loadApiUsage try범위 / loadCentersByIdCache 무로그 / deleteChild 감사누락 / generateAssessReport 버튼리셋 패턴

**성능** — updateHeaderClock 중복호출 / renderSessionListForPeriod O(N) 반복 / getVoucherUsed 루프 내 재순회 / startNoticeBanner 폴링 시 슬라이드 리셋 / renderTeacherFilter O(N) 스캔

**UI** — quick 버튼 터치타겟 충돌 / 사진버튼 aria-label / dashboard SVG 다크대비 / 학부모 일정 role=alert 누락 / 학부모홈 CLS

**PWA** — sw.js CACHE_NAME 훅 미설치 PC 위험 / SW_CODE 폴백 동기화 / listBackups·getBackup req.onerror 누락(Promise 영구 pending)

---

## 4. LOW / INFO (요약)

**LOW (28건)** — 오프라인 큐 PII localStorage / madi_last_id 공유기기 노출 / document.write 팝업차단 / IEP 세션목록 viewOtherChildren 미참조 / 2FA모달 admin→switchTab(5) / canWrite 수동열거 / 비번 최소 4자(change-password·parent-auth) / github-deploy EXACT_ALLOWED에 CLAUDE.md·AGENTS.md / api 주석 M-1 불일치 / 각종 catch _userErrMsg 미경유 / 캐시 sig 길이비교 한계 / SW Blob 폴백 origin null 등

**INFO (27건)** — wrapUntrusted 프롬프트 방어 양호 / 이미지 업로드 Edge 경유 양호 / postMessage 외부수신 없음 / consent opts 전달 정확 / _reportClientError 컬럼 일치 / prog_types 배열 처리 정확 / canDo fail-closed 양호 / admin.html 2단계 인증가드 / savePermissions 자기·superadmin 차단 / verifyJwt alg:none 차단·exp 강제 / api SERVICE_ROLE+명시검증 / manifest 아이콘 전부 존재 / SW activate 단일캐시 / 라이브프로브 SKIP 등

---

## 도메인별 건강도 점수 (100점 만점)

| 도메인 | 점수 | 한줄 평가 |
|--------|------|-----------|
| 보안(madi-app) | **62** | 클라 직접 INSERT 권한상승 + CSP unsafe-inline 2대 구조 결함, 그 외 방어는 견고 |
| DB 스키마 | **78** | child_id 죽은 컬럼이 학부모 알림 가용성 위협, 나머지는 문서화 격차 수준 |
| 코딩 컨벤션 | **80** | var/function 컨벤션 완전 준수, 전역 함수명 충돌 2건이 감점 |
| 역할·권한 | **70** | canDo fail-closed·2단계 가드 우수, 이름 기반 필터·UI/로직 불일치가 약점 |
| 에러 핸들링 | **68** | showError 표준 존재하나 빈 catch·비표준 분기 산재, 보안경로 묵살이 핵심 |
| 성능·중복 | **74** | supaCache 설계 우수, 폴링 과다요청·중복 O(N) 스캔이 주 부담 |
| UI/UX | **66** | 다크모드 인라인 hex 누락 광범위, 접근성(aria/role) 부분 결손 |
| Edge Function | **64** | verifyJwt·SERVICE_ROLE 검증 견고하나 cold-start env·permissions 누락이 치명 |
| PWA/SW | **79** | activate·manifest 양호, 푸시 구독 불일치·IDB Promise pending이 감점 |
| 라이브 프로브 | **N/A** | 자격증명 미설정으로 미수행 — 실DB 대조 후속 필수 |

**종합: 71/100** — 구조적 핵심 결함(권한상승·CSP·cold-start)을 제거하면 85+ 도달 가능.

---

## 권고 수정 순서 (로드맵)

**1순위 — 보안 구조 결함 (즉시, 1~2일)**
1. `notify-tomorrow/index.ts` env 읽기를 핸들러 내부로 이동 (C-3, 단순·저위험·고효과)
2. `change-password/index.ts` newPayload에 permissions 클레임 추가 (M-1 회귀 차단)
3. `madi-auth.js`/`madi-home.js` 회원가입·직원추가를 Edge Function 강제 경유로 전환, role/permissions 클라 페이로드 제거 (C-1)
4. 4개 Edge Function `allowNullOrigin` 운영 제거

**2순위 — 데이터 무결성·권한 일관성 (이번 스프린트)**
5. `madi-schedule.js` child_id 결정(채우기 vs 죽은컬럼 명시) + notify-tomorrow join 경로 정합 (HIGH, 학부모 알림 가용성)
6. `admin.html` removeStaffAccount center_id 필터 + 감사로그
7. `madi-home.js`/`madi-session.js` teacher 필터를 teacher_id 우선 패턴으로 통일
8. `madi-app.js` _bpAs 쿼리에 user_id 추가 (assessmentDB 소실 방지)
9. 보안경로 빈 catch 3건(logout·savePermissions·legacy token) console.warn 추가

**3순위 — 성능·UI·정리 (다음 스프린트)**
10. `madi-app.js` 폴링 경로 추가 fetch 정리(activities/IEP/notices)
11. 전역 함수명 충돌 해소: `_isMine`(2곳)·`_onKey`(2곳)·`monthBlock` 추출
12. 다크모드 인라인 hex → CSS 변수 일괄 교체(madi.css·admin.html·madi-dashboard.js·madi-parent-home.js)
13. `madi-parent-pages.js` 푸시 unsubscribe 흐름 정리, IDB req.onerror 추가
14. CSP unsafe-inline 단계적 제거(style-src 우선) — onclick→data-action 이관 후속

**후속 필수:** `MADI_PROBE_USER`/`MADI_PROBE_PW` 설정 후 `node tests/live-probe.js` 재실행 — 실DB↔SCHEMA.md 불일치·Edge 계약 검증(이번 점검 사각지대).

---

## 잘 구현된 부분 (Keep)

1. **인증 코어 견고** — verifyJwt가 alg:none 차단·exp 강제·HS256 단독 검증, 모든 엔드포인트가 공유 구현 사용. api는 SERVICE_ROLE + 명시적 권한검증(ALLOWED_TABLES·center_id 강제치환).
2. **권한 모델 fail-closed** — canDo()가 admin/superadmin true·parent false·teacher는 명시키만 허용, 미정의 키 차단. savePermissions가 자기권한·superadmin 변경 차단(서버 GET 기반 위조불가). admin.html 2단계 인증가드(localStorage→서버 재검증, 응답 전 UI 차단).
3. **코딩 컨벤션 100% 준수** — 전 26개 파일에서 arrow/class/let/const/async 0건, bare console.log 0건, anon key 하드코딩 0건.
4. **AI 보안 다층방어** — wrapUntrusted 경계래핑 + ai-proxy Edge 경유 + AI응답 escHtml 차단으로 프롬프트 인젝션·XSS 다층 차단.
5. **supaCache·PWA 기반 견실** — 5분 TTL + 쓰기 시 테이블 무효화, SW activate 단일캐시 유지·clients.claim, manifest 아이콘 전부 실재, 이미지 업로드 Edge 경유.

---

## 추가 개선 제안

- **자동 회귀 차단**: pre-commit에 ① `eyJ[A-Za-z0-9_\-\.]{50,}` (anon key) ② `no-restricted-syntax`로 arrow/let/const 패턴 grep을 추가하면 컨벤션·키노출 회귀를 영구 차단할 수 있습니다.
- **JWT permissions 클레임 단일화**: login·change-password가 각각 토큰을 조립하는 구조라 이번 M-1 회귀가 발생했습니다. `buildSessionToken(user)` 공유 헬퍼로 통일하면 클레임 누락 재발을 막습니다.
- **전역 함수명 충돌은 ESLint로 탐지 가능**: `no-redeclare`는 파일 간 전역을 못 잡으므로, 전역 선언 인벤토리(FUNCTIONS.md 활용)를 pre-commit에서 중복 검사하면 `_isMine`류 회귀를 자동 적발할 수 있습니다.
