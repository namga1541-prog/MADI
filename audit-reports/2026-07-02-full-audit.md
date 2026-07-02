# 전수감사 리포트 (2026-07-02)
발견 요약: HIGH 1건(권한 영속 누락) + MEDIUM 10건(보안·DB·권한·에러·성능) + LOW 21건 — CRITICAL 0건, 서버 방어선 견고

---

# 아이마디 APP 전수점검 결과 리포트

> 점검일: 2026-07-02 · 방식: 정적 감사 9개 도메인 병렬 + 라이브 프로브(생략됨) · 기준 커밋: main(91b5be5)

---

## 전체 요약

| 심각도 | 건수 | 비고 |
|--------|------|------|
| 🔴 CRITICAL | **0** | 즉시 중단급 결함 없음 |
| 🟠 HIGH | **1** | 권한 시스템 실질 무력화 (madi-auth.js) |
| 🟡 MEDIUM | **10** | 보안 1 · DB 2 · 권한 2 · 에러 1 · 성능 1 · UX 1 · Edge 1 · PWA 1 |
| 🔵 LOW | **21** | 컨벤션 위반·터치 타겟·미처리 rejection 등 |
| ⚪ INFO | **27** | 통과 기록 20건 내외 포함 (재감사 방지용 박제) |
| **합계** | **59** | |

- **즉시 조치 필요(HIGH 이상): 1건** — 리로드 한 번이면 teacher 권한 회수가 무효화되는 permissions 미영속 버그.
- CRITICAL 0건: 서버 프록시(center_id 강제·requireFreshSession)가 최종 방어선으로 견고하게 동작하고 있어, 클라이언트 결함이 치명타로 이어지는 경로가 차단되어 있습니다.
- **라이브 프로브는 미수행** (MADI_PROBE_USER/PW 미설정 → SKIP). 라이브 DB↔SCHEMA.md 실측 대조는 이번 감사 범위 밖입니다.

---

## 1. CRITICAL (즉시 수정 필수)

**해당 없음.** 🎉

---

## 2. HIGH (이번 스프린트 내 수정)

### H-1. [madi-auth.js:136,187 + madi-system.js:221] 권한(permissions) 미영속 — 리로드 한 번이면 권한 회수 전부 무효화

- **증상**: 로그인 시 localStorage `madi_user`에 저장하는 `_toStore` 객체에 `permissions` 필드가 빠져 있습니다. 세션 복원(madi-system.js:218-227)은 이 객체를 그대로 `currentUser`로 쓰고 이후 어디서도 permissions를 재조회하지 않으므로, **새로고침(특히 sw.js controllerchange 자동 reload) 직후 `canDo()`가 DEFAULT_PERMS(전부 true) 폴백으로 동작**합니다.
- **영향**: 관리자가 editChild/deleteSession/deleteAssessment/useAI를 false로 회수한 teacher가 리로드 한 번으로 클라이언트 게이트를 전부 되찾습니다. 서버는 viewOtherChildren만 JWT claim으로 강제하므로 **나머지 4개 권한은 사실상 기능 자체가 조용히 깨져 있는 상태**입니다.
- **권고**:
  1. `_toStore`에 permissions 포함(boolean 플래그라 민감정보 아님), 또는 세션 복원 직후 `supaFetch('madi_users?id=eq.'+id+'&select=permissions,role')` 재조회 후 머지.
  2. 장기: deleteSession/deleteAssessment/editChild도 api/index.ts에서 JWT claim 기반 서버 강제.
- ⚠️ 아래 M-4(editChild 가드 누락)·M-5(useAI 가드 누락)와 **한 묶음으로 수정해야** 권한 시스템이 실제로 복구됩니다.

---

## 3. MEDIUM (다음 스프린트)

| # | 위치 | 요지 | 권고 |
|---|------|------|------|
| M-1 | madi-iep.js:891-900 | `escHtml(String(childId))`를 인라인 onclick의 **따옴표 없는 JS 값** 위치에 삽입 — escHtml이 괄호·세미콜론을 못 막아 임의 문자열 id 행 삽입 시 저장형 XSS 경로 | `/^[0-9]+$/` 검증 후 렌더 중단, 또는 data-action 위임 + dataset 전환 |
| M-2 | SCHEMA.md:32 | 정본에서 madi_error_logs의 **center_id 컬럼 누락** (교차 증거 3건으로 실존 확정) — SSOT 드리프트로 향후 오탐·컬럼 누락 코드 유발 위험 | SCHEMA.md에 center_id 추가 + information_schema 실측으로 확정 |
| M-3 | madi-app.js:78,332 (+ madi-parent-home.js:78,186) | madi_children·madi_iep_history 읽기에 `id::text` 캐스팅 누락 (sessions/schedules/assessments·admin.html은 적용) — 2^53 초과 id 존재 시 정밀도 손실 → upsert 중복 행 | `select=id::text` 통일 적용, 또는 안전범위 실측 후 SCHEMA.md에 근거 박제 |
| M-4 | madi-growth.js:296,502 | openEditModal/saveEditModal에 `canDo('editChild')` 가드 누락 (형제 함수 4곳은 전부 검사) — 서버도 미검사라 **클라 가드가 유일 방어선인데 부재** | 두 함수 진입부 가드 + 편집 버튼 조건부 렌더 |
| M-5 | madi-parent.js:361,718,778 | AI 진입점 3곳(포트폴리오·자연어검색·FAQ)에 `canDo('useAI')` 누락 — 제한된 teacher가 Anthropic 비용 계속 소모 가능 | 세 함수에 표준 가드 추가 (getApiKeyOrAlert 직전) |
| M-6 | madi-auth.js:121-135 | 가입 직후 자동 로그인이 `r.ok`/`loginData.error` 미검사 — 401 응답에도 fallback user로 무토큰 앱 진입 → 전 API 401. **보류 중인 '회원가입 401' 건과 정확히 맞물림** | error/token 부재 시 throw → 기존 catch(수동 로그인 유도)로 합류, fallback 분기 제거 |
| M-7 | madi-app.js:94,136,145-166 | supaCache TTL(5분) 만료마다 90일 이전 전체 세션+30일 이전 전체 일정을 `_supaFetchAll`로 전량 재다운로드 — 운영 연차에 비례해 무한 증가 | 과거 GET에 전용 장TTL(30~60분) opts.ttl, 또는 `_bpCacheSig` 동일 시 리셋 스킵 |
| M-8 | index.html:1259 | 헤더 '다음 세션'(clockNext)이 inline `display:none`으로 영구 숨김인데 updateHeaderClock은 매분 계산해 기록 — 죽은 기능 + 낭비 연산 (DOM 박제 잔재) | 봉인 의도면 주석+계산 스킵, 복원 의도면 display:none 제거 |
| M-9 | supabase/functions/upload-image/index.ts:161,230 | 'quick' 폴더 수업 사진(아동 얼굴 PII)이 **공개 버킷 URL**로 반환 — URL 유출 시 접근 통제 전무. 서명 URL 인프라(`__sign_board_images__`)는 이미 구축돼 있으나 전환 미완 | 버킷 비공개 전환 + 서명 URL 완전 이관, 최소한 quick 폴더만 비공개 분리 |
| M-10 | admin.html:3275-3284 | controllerchange 자동 reload에 dirty-check 없음 — 공지 작성 중 배포되면 복귀 즉시 reload로 **미저장 입력 유실** | index.html의 `_swDirty` 패턴 이식 (작성 중이면 배너로 대체) |

---

## 4. LOW / INFO

### LOW (21건)

**보안 (3)**
- [madi-parent.js:710] month 인자 `escHtml` 사용 — jsArg 규칙 위반 (같은 줄 2곳)
- [admin.html:3019] copyLicenseKey 인자 `escHtml` 사용 — jsArg 규칙 위반, 게다가 admin.html은 ESLint 범위 밖
- [admin.html:3099 + madi-home.js:701] license_key/centerId를 encodeURIComponent 없이 쿼리스트링 연결

**권한 (2)**
- [madi-session.js:527,552,653] 백업 복원(센터 전체 DELETE 포함)에 teacher 차단 없음 — 현재 UI 미도달(죽은 UI)이나 재연결 시 위험
- [madi-iep.js:352] '👤 작성자' 라벨이 `role === 'admin'`만 검사 — superadmin 배제, `isAdminRole()` 미사용

**에러·안정성 (3)**
- [madi-quick.js:799-863] quickSave 체인 끝 `.catch` 부재 — 동기 예외 시 저장 버튼 '⏳ 저장 중...' 영구 고착
- [madi-parent-pages.js:558-587] 푸시 토글 체인 미처리 rejection 2곳 + SW 등록 실패 환경에서 무반응
- [.eslintrc.js:19-53] globals에 스테일 항목 3개(showSection·supaCache·ANON_KEY) — no-undef 무력화

**성능 (3)**
- [madi-app.js:81,128,332,350] assessments/IEP/activities 날짜 창 없이 전량 로드 — 누적형 페이로드 증가
- [madi-schedule.js:237 ↔ madi-home.js:157] madi_users 쿼리 문자열 중복 + `_teacherList` 수동 무효화 2곳 의존
- [madi-schedule.js:927-945] `window._delEsc` 전역 ESC 리스너 — 재진입 시 고아 리스너 발생, 해제 코드 3곳 복붙

**UX·터치 타겟 (4)**
- [admin.html 전체] aria-label 0개 + 아이콘 버튼 28~30px (44px 미달)
- [index.html:2184] 학부모 '모두 읽음' 버튼 약 24px — 학부모 포털 최악의 터치 타겟
- [madi-quick.js:404,433,455] 공개 토글 스위치 50×28px 등 44px 미달
- [index.html·admin.html 다수] 다크모드 미대응 인라인 색상 하드코딩 — 봉인 해제 시 즉시 회귀

**Edge·PWA (4)**
- [api/index.ts] 메인 DB 프록시만 rate limit 전무 (특히 쓰기 무제한)
- [_shared/auth.ts:32-36] 운영 CORS에 localhost:3000 상시 포함 (credentials:true)
- [madi-system.js:351-358] Blob URL SW 폴백은 브라우저가 거부하는 dead code — 190줄 SW_LINES 유지 비용 유발
- [madi-deploy.js:362] 인앱 배포가 offline.html·manifest.json·icon 미포함 / [sw.js:158-162] notificationclick URL 완전일치 판정으로 중복 창

### INFO (27건 — 주요만 발췌)

**통과 확인 기록 (후속 감사 재조사 방지용 — 가치 높음)**
- 보안: eval/new Function 0건, anon key 하드코딩 0건, 직접 fetch는 전부 Edge 정상 경로, sessionStorage JWT는 문서화된 의도적 설계
- 권한: admin.html 2단계 가드 견고, dinosau 우회 없음, 서버 center_id/parent_visible 격리 확인
- 에러: supaFetch 86개 호출 전부 .catch 존재, JSON.parse 19곳 전부 방어, 전역 리포터 동작 — **에러 핸들링 규율이 매우 높음**
- Edge: 11개 함수 전부 `--no-verify-jwt` 정상 배포 확인(라이브 프로브 대체 검증), service role 일관 사용
- PWA: CACHE_NAME 자동 bump 이중 안전망, IndexedDB 처리 모범적, 아이콘 8종 실재
- 컨벤션: 운영 25개 파일 arrow/let/const/async 0건, console.log 0건

**개선 제안성 INFO**
- eslint-disable no-unsanitized 약 150곳 — 표본 검수 전부 안전하나 사유 명기 관행화 권장
- GLOBAL_TABLES 주석이 lounge_comments/push_subscriptions에 대해 사실과 불일치 (+ 댓글 GET center 미필터는 별도 검토 항목)
- 폴링 30초 vs TTL 5분 — 실효 동기화 지연은 5분 (두 상수 연동 필요)
- 학부모 알림 fan-out 실패 완전 묵음 / totp 인라인 세션검증 SSOT 이탈 / parent-auth makeCORS 중복 / SVG 차트 색상 하드코딩 / admin toggleDarkMode 데드코드 / apikeyBar DOM 박제 재발 등

---

## 도메인별 건강도 점수 (100점 만점)

| 도메인 | 점수 | 한줄 평가 |
|--------|------|-----------|
| 에러 핸들링 | **93** | 86개 호출 전수 .catch, showError 표준 정착 — 코드베이스 최강 영역. 가입 자동로그인 1건만 수정하면 됨 |
| 코딩 컨벤션 | **92** | 운영 코드 위반 0건, ESLint 게이트 실동작. 스테일 globals 정리만 남음 |
| Edge Functions | **88** | 배포·인증·CORS·정보비노출 전부 견고. quick 사진 공개 URL이 유일한 실질 이슈 |
| 보안 (클라이언트) | **85** | XSS 방어 체계 성숙. jsArg 규칙 위반 산발 3곳 + escHtml 컨텍스트 한계 1곳 |
| PWA·SW | **84** | 캐시 bump 이중 안전망 등 모범적. admin dirty-check 부재가 데이터 유실 리스크 |
| DB 스키마 일관성 | **80** | 코드는 대체로 정합하나 **정본(SCHEMA.md) 자체의 드리프트**가 2건 — SSOT 신뢰도 회복 필요 |
| 성능·중복 | **78** | 렌더 시그니처 보호는 좋으나 과거 데이터 전량 재전송 구조가 운영 연차와 함께 악화되는 시한부 설계 |
| UI·UX | **75** | 기능 UX는 준수하나 admin 접근성 공백(aria-label 0개)·터치 타겟 미달·다크모드 부채 누적 |
| 역할·권한 | **62** | **HIGH 1 + MEDIUM 2가 결합해 teacher 권한 관리 기능이 사실상 깨져 있음** — 서버 격리 덕에 참사는 면했으나 최우선 수술 대상 |
| 라이브 프로브 | **N/A** | 자격증명 미설정으로 미수행 — 점수 산정 불가 |

---

## 권고 수정 순서 (로드맵)

### 🥇 1순위 — 권한 시스템 복구 패키지 (반나절, 파일 4개)
서로 맞물린 결함이므로 한 커밋 묶음으로:
1. **madi-auth.js** `_toStore`에 permissions 포함 (H-1)
2. **madi-growth.js** openEditModal/saveEditModal에 canDo('editChild') 가드 + 버튼 조건부 렌더 (M-4)
3. **madi-parent.js** AI 진입점 3곳 canDo('useAI') 가드 (M-5)
4. **madi-session.js** 백업 복원에 isAdminRole 가드 (LOW지만 같은 계열, 2줄)
5. 검증: 권한 회수된 teacher 계정으로 리로드 → canDo 유지 확인

### 🥈 2순위 — 데이터 유실·가입 차단 해소 (반나절, 파일 3개)
1. **madi-auth.js:121-135** 가입 자동로그인 r.ok 검사 (M-6) — **보류 중 '회원가입 401' 버그 동시 해소 기대**
2. **admin.html** SW dirty-check 이식 (M-10)
3. **madi-quick.js** quickSave 최상위 .catch (LOW, 버튼 고착)

### 🥉 3순위 — SSOT·보안 마감 (1일)
1. **SCHEMA.md** center_id 추가 + madi_licenses 실측 확정 (M-2) — 라이브 프로브 자격증명 설정 후 `node tests/live-probe.js`와 병행 권장
2. **madi-app.js·madi-parent-home.js** id::text 통일 (M-3)
3. **madi-iep.js** childId 숫자 검증 또는 data-action 전환 (M-1) + jsArg 위반 3곳 일괄 교체 (LOW)
4. **upload-image** quick 폴더 비공개 전환 (M-9) — 아동 PII라 정식 오픈 전 필수

### 4순위 — 성능·UX 부채 (다음 스프린트)
- M-7(과거 데이터 TTL), M-8(clockNext 정리), assessments/IEP lazy-load, 터치 타겟·aria-label 일괄 정비, 다크모드 색상 목록 박제

---

## 잘 구현된 부분 (Keep)

1. **에러 핸들링 규율** — supaFetch 86개 호출 지점 전수 .catch, showError/_userErrMsg 경유 원문 비노출, window.onerror+unhandledrejection 전역 수집까지. 이 규모의 바닐라 JS에서 이례적으로 높은 수준입니다.
2. **서버 프록시 최종 방어선** — center_id 강제·requireFreshSession·부모글 검증 등 서버 격리가 견고해, 이번에 발견된 클라이언트 가드 누락들이 CRITICAL로 승격되지 않았습니다. "클라는 UX, 서버가 보안" 원칙이 실제로 작동 중입니다.
3. **배포 안전망 이중화** — pre-commit 훅의 CACHE_NAME 자동 bump + SW_LINES 동등성 검사 + 인앱 배포 타임스탬프 재주입. PWA 캐시 사고 재발 방지 장치가 겹겹이 박혀 있습니다.
4. **컨벤션 자동 강제** — ESLint no-restricted-syntax·no-unsanitized가 커밋 게이트로 실동작해 운영 25개 파일에서 위반 0건. 규칙이 문서가 아니라 도구로 존재합니다.
5. **의도적 설계의 문서화 습관** — sessionStorage JWT 폴백, fire-and-forget 주석, ARCHITECTURE.md 박제 등 "왜 이렇게 했는가"가 코드에 남아 있어 이번 감사에서도 오탐을 다수 걸러냈습니다.

---

*미수행 항목: 라이브 프로브(라이브 DB 무결성·SCHEMA.md 실측 대조·Edge Function 계약 점검) — MADI_PROBE_USER/MADI_PROBE_PW 설정 후 재실행 필요.*
