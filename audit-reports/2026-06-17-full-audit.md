# 전수감사 리포트 (2026-06-17)

발견 요약: CRITICAL 2건(저장 Promise 미처리) + HIGH 17건(보안·권한 우선) + MEDIUM 31건 + LOW 28건 + INFO 36건(긍정 확인). 즉시 조치 필수 19건.

---

# 아이마디 APP 전수점검 결과 리포트

## 전체 요약

| 심각도 | 건수 | 비고 |
|--------|------|------|
| **CRITICAL** | 2 | 즉시 수정 필수 (저장 실패 무피드백) |
| **HIGH** | 17 | 이번 스프린트 내 수정 |
| **MEDIUM** | 31 | 다음 스프린트 |
| **LOW** | 28 | 점진 개선 |
| **INFO** | 36 | 확인·문서화 (다수 "양호" 긍정 확인) |
| **합계** | **114** | 9개 정적 도메인 + 라이브 프로브 1 |

> **즉시 조치 필요(CRITICAL+HIGH) = 19건.** 그중 보안 도메인 HIGH 3건과 권한 도메인 HIGH 2건이 핵심.
> 가장 시급한 구조적 결함: **`madi-iep.js` 저장 Promise 미처리(CRITICAL 2건)** — 저장 실패가 사용자에게 안 보임.

---

## 1. CRITICAL (즉시 수정 필수)

### C-1. `madi-iep.js:37` — saveOneSession 결과 완전 방치
세션 저장 Promise를 `var _savePromise = saveOneSession(_newSession)` 으로 변수에만 담고 `.then/.catch`를 전혀 연결하지 않음. **저장 실패 시 사용자에게 아무 피드백 없이 데이터가 로컬 메모리에만 존재**하는 상태가 됨.
→ `_savePromise.then(function(ok){ if(!ok) showToast('⚠️ 저장 실패'); }).catch(function(e){ showError(e, '세션 저장'); })` 로 처리. `madi-quick.js:847`의 `_qSaveP.then()` 패턴 참고.

### C-2. `madi-iep.js:136, 384` — 저장 결과 무관 성공 토스트
saveOneSession 호출 2곳에 `.catch` 미연결. 특히 **날짜 수정(384)은 `showToast('✅ 날짜 수정 완료!')`를 저장 결과와 무관하게 즉시 표시** — 저장이 실패해도 성공 토스트가 뜸. 데이터 정합성 착시를 유발.
→ `saveOneSession(s).then(function(ok){ showToast(ok ? '✅ 날짜 수정 완료!' : '⚠️ 저장 실패'); }).catch(function(e){ showError(e, '날짜 수정'); })` 로 변경.

> **공통 진단**: `madi-iep.js`의 저장 경로(37·136·384)가 모두 동일 결함. CLAUDE.md "Fix-Verify Loop §6-1 저장·삭제 경로 의미 검수" 대상이며 자동 게이트(lint/smoke)로는 못 잡힘. 한 번에 묶어 수정 권장.

---

## 2. HIGH (이번 스프린트 내 수정)

### 보안 (3건)

- **[madi-core.js:70-74] viewOtherChildren 서버 미강제 (M-1)** — teacher 권한이 클라이언트 UI 필터로만 작동. 동일 센터 teacher가 `/api` 직접 호출 시 담당 외 전체 아동 PII 조회 가능. 코드 주석에 "서버 강제 경계 없음" 명시.
  → `madi_children`에 `assigned_teacher_id` 컬럼 신설 + Edge `/api` teacher 스코프 필터 강제. **Edge 도메인 MEDIUM(api/index.ts:826-855)과 동일 이슈 — 함께 처리.**

- **[madi-auth.js:136-137, 187-188] role·permissions localStorage 평문 저장** — XSS 발생 시 `permissions` 객체 탈취로 클라이언트 권한 검사 우회 가능.
  → 단기: `_toStore`에서 `permissions` 필드 제거. 장기: role·permissions를 서버 재검증(httpOnly)으로 이관.

- **[madi-ai.js:84, 456, 514, 572, 776] AI 응답 innerHTML 주입 5곳 eslint-disable 누적** — 현재는 escHtml 래핑되어 있으나 Anthropic 응답 모드 변경/sanitize 버그 시 저장형 XSS. eslint-disable 누적이 실제 위험 지점을 은폐.
  → DOMPurify 등 추가 sanitization 레이어 또는 textContent+DOM API. eslint-disable에 리뷰 게이트 부여.

### 권한 (2건)

- **[admin.html:2668, 2770] createParentAccount / deleteParentAccount 역할 가드 누락** — 다른 admin 함수들(sendPushTest 등)은 `currentUser.role` 가드를 갖췄으나 학부모 계정 생성·삭제만 누락. (페이지 진입 2차 서버검증 있어 실질 위험은 낮음, 패턴 일관성·심층방어)
  → 두 함수 최상단에 `if (!currentUser || (currentUser.role !== 'admin' && currentUser.role !== 'superadmin')) { showToast('⚠️ 관리자만 가능합니다'); return; }` 추가.

- **[admin.html:2742] loadParentList center_id 누락 시 전체 조회** — admin 계정의 center_id가 null(세션 부분 소실 등)이면 센터 구분 없이 전체 학부모 조회. `madi-board.js:69-71`의 차단 패턴과 불일치.
  → `if (!cid && currentUser.role !== 'superadmin') { ...오류...; return; }` 로 비-superadmin 차단.

### 코딩 컨벤션 — 전역 함수명 충돌 (4건)

- **[madi-child-detail.js:474 / madi-dashboard.js:114] `_isMine` 교차 파일 충돌** — 시그니처 다른 두 전역 함수(childId vs 스케줄 객체). 로드 순서로 후자가 전자를 덮어써 런타임 충돌.
  → `_cdIsMine` / `_dpIsMine` 로 분리 또는 IIFE 격리.

- **[madi-auth.js:476 / madi-board.js:797] `_onKey` 교차 파일 충돌** — Escape 동작이 `_dismiss()` vs `_close()`로 갈림. 후자가 전자를 덮어써 모달 키보드 해제 오동작 가능.
  → `_authOnKey` / `_boardOnKey` 로 분리.

- **[madi-app.js:419/457, 423/458] `close`·`doCancel` 동일 파일 중복 정의** — 서로 다른 모달 헬퍼 클로저지만 전역 노출 시 호이스팅으로 마지막 정의가 덮어쓸 위험.
  → `_confirmClose`/`_alertClose` 등 구체명 또는 IIFE.

- **[madi-ai.js:373, 530] `monthBlock` 동일 로직 복붙** — renderIEP/renderIEPView 각 내부 중첩. 한쪽만 수정 시 두 렌더러 결과 갈림.
  → 공통 헬퍼로 추출.

### 에러 처리 (6건)

- **[madi-chat.js:513 / madi-child-detail.js:46] 음성 인식 영문 에러코드 직접 노출** — `not-allowed`/`network`/`no-speech` 등을 그대로 토스트. → 한국어 매핑 테이블.
- **[madi-child-detail.js:409 / madi-home.js:209] 감사 로그 POST 완전 묵살** — `.catch(function(){})`로 운영 추적성 손실. → 최소 `console.warn` 로깅 (madi-system.js:114 패턴).
- **[madi-quick.js:53] 손상 드래프트 영구 잔류** — catch에서 `return null`만, removeItem 미호출. → catch에서 `sessionStorage.removeItem` 정리.
- **[madi-parent-pages.js:199] 알림 카드 무음 숨김** — 네트워크 오류/알림 없음 구분 불가, 로그 없음. → `console.warn` 추가.
- **[madi-parent-home.js:699] 바우처 횟수 무음 0 폴백** — 네트워크 오류를 0회로 오표시. → 로그 + 실패 UI 구분.
- **[madi-assessment.js:1063] btn 초기화 이중 실행 가능·의도 불명** — → 명명 함수 `_resetBtn()`로 양 분기 통일(madi-ai.js resetBtn 패턴).

---

## 3. MEDIUM (다음 스프린트)

**보안 (4)**: `madi-parent-pages.js:402,492` parent-auth supaFetch 우회+에러원문 노출 · `madi-core.js:509-517` 에러스택 PII 미필터 전송 · `madi-board-notice.js:40-44` isSafeUrl 검증 로직 이원화(SSOT화) · `madi-auth.js:360` 로그아웃 fire-and-forget 쿠키삭제 실패 미인지

**권한 (3)**: `madi-core.js:69-83` canDo parent 명시 차단 없음(fail-closed 필요) · `madi-iep.js:11` saveSession 역할 가드 누락 · `madi-schedule.js:611` teacher가 타 교사 명의 일정 추가 가능

**에러 처리 (10)**: `madi-session.js:68,128` JSON.parse try-catch 누락 · `madi-system.js:220` 초기화 6개 함수 통째 try-catch(예외 시 강제 로그아웃) · `madi-parent-home.js:752` 읽음상태 parse 무방어 · `madi-board.js:84,514` 에러처리 비일관 · `madi-parent-pages.js:51,181` 에러객체 없는 catch · `madi-quick.js:847` 저장실패 인지 어려움 · `madi-auth.js:360` 로그아웃 fetch 묵살

**Edge Functions (2)**: `api/index.ts:826-855` teacher 스코프 미강제(=M-1) · `api/index.ts:34-36` madi_settings cross-tenant write 검증 필요(M-8 재확인)

**PWA (2)**: `madi-deploy.js:467-474` 인앱 배포 시 sw.js CACHE_NAME stale 업로드(디바이스 미반영 잠재 원인) · `madi-deploy.js:240-265` offline.html/manifest.json 배포 스캔 누락

**UI/UX (4)**: `madi-parent-pages.js:812` 답글 배지 인라인색 다크모드 깨짐 · `admin.html:2110` 역할 배지 다크 미대응 · `madi.css:1798-1903` 대시보드 태그 클래스명 불일치로 다크 색코딩 소실 · `madi-dashboard.js:550,604` 긍정 델타 다크모드 색 소실

**코딩 컨벤션 (3)**: `madi-core.js:145,153` SUPA_URL 하드코딩(정적 사이트 수용 가능) · `madi-app.js:574` console.debug 가드 누락 · console.warn/error 50여개 + onclick 169건 점진 이관

---

## 4. LOW / INFO (요약)

**LOW (28)** 주요 항목:
- safeSetItem 우회 직접 localStorage 쓰기 3건 (`madi-session.js:459`, `madi-deploy.js:485`, `madi-parent-home.js:754`) — PII 방어 레이어 일관성
- 다수 `.catch(function(){})` 무음 처리 (`madi-deploy.js:210`, `madi-parent-pages.js:644`, `madi-parent.js:583,599`) — console.warn 보강
- 접근성/터치타겟 (`madi-parent-home.js:142` 40px, `admin.html:2105` aria-label 누락+터치타겟)
- 다크모드 인라인색 (`madi-dashboard.js:784-801`, `madi-parent-home.js` 다수)
- 성능: renderChildGrid/updateHeaderClock 강결합·재집계 (madi-app.js, madi-child-detail.js) — 우선순위 매우 낮음

**INFO (36)** — 대부분 **긍정 확인**:
- 코딩 컨벤션 완전 준수: arrow/class/const/let/async-await/console.log **0건**, anon key 하드코딩 없음
- supaCache·타이머 정리·리스너 1회 바인딩·IndexedDB 트랜잭션·SW activate 캐시 삭제 모두 모범적
- Edge Functions: CORS 화이트리스트·JWT HS256 강제·rate-limit 전면 적용·service_role 서버전용·입력검증 견고
- 검토 권장: `hashPassword` SHA-256 무솔트(서버 bcrypt 확인) · session memo AI 전송 시 미가명화 · 2FA 미설정 admin 강제화

> **라이브 프로브 미실행**: `MADI_PROBE_USER`/`MADI_PROBE_PW` 미설정으로 SKIP. **라이브 DB↔SCHEMA.md 정합성·Edge 계약 검증이 이번 점검에서 누락됨.** 읽기전용 프로브 계정 자격증명 설정 후 `node tests/live-probe.js` 재실행 권장.

---

## 도메인별 건강도 점수 (100점 만점)

| 도메인 | 점수 | 한줄 평가 |
|--------|------|-----------|
| **에러 처리** | **62** | 유일하게 CRITICAL 보유 도메인. iep.js 저장 경로 무처리 + 무음 catch 다수. 가장 시급. |
| **보안 (클라이언트)** | **74** | M-1(서버 미강제)·localStorage 민감정보가 구조적 약점. escHtml·jsArg 기반은 견고. |
| **역할·권한** | **78** | admin.html 2차 서버검증 우수. 클라이언트 가드 일관성(parent fail-closed) 부족. |
| **코딩 컨벤션** | **80** | var/function/.then 완전 준수. 전역 함수명 충돌 4건이 감점 핵심. |
| **PWA / SW** | **85** | activate·SW 업데이트 배너·IndexedDB 모범적. 인앱 배포 CACHE_NAME stale만 보완. |
| **UI/UX** | **85** | 빠른기록 모바일 설계 우수. 다크모드 인라인색 우회가 반복 패턴. |
| **DB 스키마 일관성** | **88** | INFO만. audit_log POST 단일객체/배열 혼용(PostgREST 허용, 무해). |
| **성능·중복** | **90** | supaCache·폴링·타이머 정리 모범적. 보조 컬렉션 폴링 게이팅만 여지. |
| **Edge Functions 보안** | **88** | 입력검증·rate-limit·키관리 견고. teacher 스코프·settings cross-tenant만 트레이드오프. |

---

## 권고 수정 순서 (로드맵)

### 1순위 — 즉시 (CRITICAL + 데이터 정합성)
1. **`madi-iep.js:37, 136, 384`** — saveOneSession Promise에 `.then(ok)/.catch(showError)` 연결. 특히 384 성공토스트를 결과 조건부로. (CRITICAL 2건 동시 해소)
2. **`admin.html:2668, 2770, 2742`** — createParentAccount/deleteParentAccount 역할 가드 + loadParentList center_id 가드 추가. (3줄 추가, 저위험·고효과)

### 2순위 — 이번 스프린트 (충돌·보안)
3. **전역 함수명 충돌 4건** — `_isMine`(child-detail/dashboard), `_onKey`(auth/board), `close`/`doCancel`(app), `monthBlock`(ai). 접두어 분리 또는 IIFE. 런타임 오동작 차단.
4. **`madi-auth.js:136-187`** — `_toStore`에서 permissions 제거 (단기 XSS 표면 축소).
5. **에러 처리 HIGH 6건** — 음성 에러 한국어 매핑(chat/child-detail), 감사 로그 console.warn(child-detail/home), 드래프트 정리(quick), 알림/바우처 로그(parent-*).
6. **`madi-deploy.js:467-474`** — 인앱 배포 직전 sw.js CACHE_NAME 런타임 bump. ("디바이스 미반영" 반복 증상 구조적 차단)

### 3순위 — 다음 스프린트 (서버·일관성)
7. **M-1 서버 강제** — `madi_children.assigned_teacher_id` 신설 + `api/index.ts:826-855` teacher 스코프 필터. (SCHEMA.md/MIGRATIONS_RUNBOOK 절차 필수, 보안 HIGH의 근본 해소)
8. **다크모드 클래스 SSOT** — `madi.css` 태그 클래스명 정합(.new/.done/.wait), 인라인색 → 토큰 일괄 교체.
9. **MEDIUM 잔여** — canDo parent fail-closed, JSON.parse try-catch 보강, isSafeUrl SSOT화, madi_settings cross-tenant write 검증(M-8 재확인).
10. **라이브 프로브 실행** — 프로브 계정 자격증명 설정 후 `node tests/live-probe.js`로 라이브 DB↔SCHEMA 정합성 검증.

---

## 잘 구현된 부분 (Keep)

1. **코딩 컨벤션 완전 준수** — arrow function·class·const·let·async/await·console.log가 **전 코드베이스 0건**. anon key 하드코딩 없음. 26개 파일 19,000줄 규모에서 이 수준의 일관성은 드묾.
2. **Edge Functions 보안 모범** — CORS 화이트리스트+fail-closed, JWT HS256 강제(alg confusion 차단), rate-limit 전 엔드포인트 적용, service_role 서버전용, 입력검증(모델 화이트리스트·magic-bytes·traversal 차단)이 일관되게 견고.
3. **admin.html 2단계 인증** — 1차 localStorage + 2차 서버 httpOnly 쿠키 검증으로 currentUser.role 덮어쓰기 → localStorage 변조 권한상승 원천 차단. fetch 실패 시 fail-safe 추방.
4. **supaCache·폴링·타이머 인프라** — 5분 TTL+쓰기시 자동 무효화+djb2 해시, 모든 타이머 clearInterval 정리, 전역 리스너 1회 바인딩 가드, 유휴/내-변경/백그라운드 폴링 스킵. 성능·중복 도메인 90점의 근거.
5. **SW 업데이트 UX** — 입력 작성 중이면 자동 reload 보류+지속 배너로 세션기록 유실 방지, 최초 설치 무한 새로고침 방지. IndexedDB 트랜잭션 oncomplete/onerror/onabort + db.close() 누수 방지.
