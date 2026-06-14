# 전수감사 리포트 (2026-06-14)

**발견 요약**: CRITICAL/HIGH 0건, MEDIUM 6건(보안·PWA·UI 접근성), LOW 24건, INFO 32건. 베타 출시 차단 결함 0건. 라이브 프로브는 자격증명 미설정으로 생략.

---

# 아이마디 APP 전수점검 결과 리포트

## 전체 요약

이번 회차는 정적 9개 도메인 + 라이브 프로브로 진행되었으며, 라이브 프로브는 자격증명 미설정으로 생략되었습니다(추측 결과 미기재).

| 심각도 | 건수 | 의미 |
|--------|------|------|
| CRITICAL | 0 | 즉시 수정 필수 |
| HIGH | 0 | 이번 스프린트 내 수정 |
| MEDIUM | 6 | 다음 스프린트 |
| LOW | 24 | 점진 개선 |
| INFO | 32 | 양호 사항(기준선 확인) |
| **합계** | **62** | — |

**즉시 조치 필요 항목: 0건** (CRITICAL·HIGH 모두 0). 베타 출시를 차단하는 결함은 발견되지 않았습니다. MEDIUM 6건은 보안 방어심도(2건)·PWA 견고성(2건)·UI 접근성/터치타겟(2건)에 집중되어 있으며, 모두 "서버 경계는 이미 막고 있으나 추가 방어층/일관성이 부족" 또는 "키보드·터치 접근성 보강" 성격입니다.

---

## 1. CRITICAL (즉시 수정 필수)

**해당 없음.** CRITICAL 등급 발견사항이 없습니다.

---

## 2. HIGH (이번 스프린트 내 수정)

**해당 없음.** HIGH 등급 발견사항이 없습니다.

---

## 3. MEDIUM (다음 스프린트)

### 보안 / Edge Functions

**[supabase/functions/_shared/auth.ts:39-43 makeCORS] null Origin + credentials CSRF 표면**
미허용 Origin에 기본 ACAO를 강제 반환하고 항상 `Access-Control-Allow-Credentials: true`를 동반합니다. `allowNullOrigin=true`인 ai-proxy/change-password 등에서 sandboxed iframe·data: 문서가 Origin: null로 위장해 자격증명 동반 요청·응답 읽기가 가능합니다(비용 큰 ai-proxy가 표면).
→ file:// 로컬 실행이 운영에 불필요하면 ai-proxy/change-password의 `allowNullOrigin`을 false로 좁혀 null Origin 표면 제거. JWT가 1차 방어이므로 defense-in-depth 차원.

**[supabase/functions/_shared/auth.ts:131-186 requireFreshSession] 읽기 경로 세션 무효화 fail-open**
`requireFreshSession`·`checkRateLimit`가 기본 fail-open이라, Supabase REST 일시 장애 시 로그아웃·강제종료·비번변경된 옛 토큰으로도 READ가 통과합니다. logout의 rate limit도 fail-open이라 RPC 장애 시 무제한 `session_revoked_at` PATCH 유발 가능.
→ 민감 데이터(madi_users/madi_settings) READ에 한해 `failClosed` 상향 검토. 최소한 이 trade-off를 ARCHITECTURE.md에 박제 확인.

**[supabase/functions/parent-auth/index.ts:44-97 checkRateLimit] 메모리 폴백이 멀티 isolate에서 무력 → 전화번호 enumeration**
RPC 실패 시 in-memory Map 폴백은 isolate 간 비공유·cold-start마다 0 초기화라 사실상 rate limit이 무력화됩니다. 무인증 lookup은 `alreadyJoined`·children 배열로 가입여부·아동명을 노출해 enumeration 가치가 높습니다.
→ RPC 장애 시 무인증 엔드포인트는 메모리 폴백 분당 한도를 더 낮추거나 연속 RPC 실패 감지 시 503 반환.

### PWA / Service Worker

**[madi-deploy.js:35-46 _loadFolderHandle] IndexedDB 연결 정리 비대칭 → 누수·onblocked 위험**
readonly 트랜잭션 `req.onerror`가 `resolve(null)`만 하고 `db.close()`를 호출하지 않습니다. `oncomplete`가 보장되지 않는 경계 케이스에서 연결 누수 → 이후 스키마 업그레이드 onblocked(M-26) 가능. 같은 파일 `_saveFolderHandle`은 세 경로 모두 close하는 것과 대조됩니다.
→ `req.onerror`에서도 `db.close()` 호출, 또는 oncomplete/onerror/onabort 세 경로 통일.

**[sw.js:13-21 install / 22-28 activate] offline.html 영구 누락 창**
offline.html은 install 시점에만 적재되고 c.add 실패가 .catch로 삼켜집니다. 그 SW 버전 동안 오프라인+HTML 캐시 미스 시 디자인된 offline.html 대신 평문 503만 표시됩니다.
→ activate(또는 networkFirst 폴백 직전)에서 `caches.match(OFFLINE_URL)`가 없으면 한 번 더 c.add 시도하는 자가복구 추가.

### UI / UX (접근성·터치타겟)

**[madi-dashboard.js:277,321,364-374,619,783-798] 대시보드 클릭 div의 키보드·SR 접근 불가**
Teacher/Admin 대시보드의 타임라인 행·빠른액션 행·'내 담당 아동'(dp-child)·'주간 아동 변동'(dp-change-row)이 `onclick`만 가진 `<div>`입니다. role/tabindex/keydown/aria-label이 없어 키보드(Tab+Enter)·스크린리더 사용자가 핵심 네비게이션(세션 기록·캘린더·게시판·아동 상세 진입)을 전혀 사용할 수 없습니다. 학부모 포트폴리오 카드(parent-home.js:339)는 올바른 패턴을 적용하고 있어 일관성도 깨집니다.
→ `<button>`으로 교체하거나 `role="button" tabindex="0" aria-label=... + onkeydown(Enter/Space→click)`을 학부모 카드와 동일하게 적용.

**[index.html:2072-2073, madi-quick.js:361] 모바일 우선 화면의 터치 타겟 미달**
빠른기록 헤더 새로고침·홈 버튼(약 34px), 빠른기록 폼 닫기 버튼(약 30px)·사진삭제(32px)가 WCAG 최소 44px·권장 48px에 미달합니다. 모바일 우선 화면임에도 한 손 조작 시 오탭 위험.
→ 보조 버튼에 `min-height:44~48px`(빠른기록은 48px 권장) 일괄 적용.

---

## 4. LOW / INFO

### LOW (24건 — 점진 개선)

**보안 (3)**
- madi-board.js: lounge admin/superadmin 가시성이 클라이언트 필터 의존 — 서버가 center scoping 하는지 확인 후 문서화(서버가 강제하면 비이슈).
- madi-auth.js:137,188: localStorage `madi_user`의 role/center_id는 변조 가능 — UI 부트스트랩 캐시로만 취급(현 상태 양호), 불변식 문서화.
- madi-ai.js 외: 124개 `eslint-disable no-unsanitized` — 현재 전부 escHtml/jsArg 적용돼 정당하나 자동 XSS 게이트가 꺼진 라인. html 빌더 편집 시 수동 재감사.
- tools/check-sw-sync.js:29: `new Function` 사용(빌드 툴, 신뢰 입력) — JSON.parse로 교체 권장(저우선).

**역할/권한 (3)**
- madi-board.js:74 loadLoungePosts: 비-superadmin인데 center_id falsy면 필터 누락 — renderLibrary(496)처럼 가드 통일(서버는 강제하므로 클라 일관성).
- madi-child-detail.js:686: empty-state 분기가 `role !== 'admin'` 단독 — `isAdminRole()`로 교체(동작 변화 없음).
- madi-home.js:149,190: loadStaffMgmtList/removeStaffAccount 진입부 role 가드 누락 — savePermissions 패턴으로 한 줄 추가.

**에러 핸들링 (3)**
- madi-parent-pages.js:446,529: raw fetch .catch에서 `e.message` 원문 노출 — `_userErrMsg`/고정 안내로 교체.
- madi-auth.js:156: 회원가입 .catch에서 서버 원문 노출 가능 — 의도적 throw 메시지만 표시, 그 외 `_userErrMsg('가입')`.
- madi-assessment.js:1043-1073: 성공 렌더 .then 동기 예외 시 실패 화면 오인 — resetBtn 헬퍼 통일 + 렌더 예외 별도 try-catch.

**성능/중복 (3)**
- madi-schedule.js:345 renderWeekGrid: `weekDates.some` O(N×7) — weekSet 룩업맵으로 O(N) 단순화.
- madi-schedule.js:827-828 renderWeekGridByChild: childById 맵 중복 빌드 — `_schedChildById()` 캐시 재사용.
- madi-child-detail.js:530-537: 'recent' 정렬이 id순 배열 마지막을 최신으로 가정 — 과거날짜 후입력 시 어긋남(정확도 이슈, 비용 없음).

**Edge Functions (4)**
- api/index.ts:830-855: 같은 센터 teacher 간 아동 격리는 서버 강제 불가(assigned_teacher_id 컬럼 부재) — 요구사항이면 컬럼 신설 후 필터.
- api/index.ts:946-978: staff POST가 무솔트 SHA-256 저장 후 첫 로그인 시 bcrypt 승격 — 미로그인 기간 약한 해시 노출, 서버 즉시 bcrypt로 통일 권장.
- totp/index.ts:87-107: 인라인 세션 검증이 컬럼-미존재 retry 없음 — `requireFreshSession(failClosed:true)`로 교체.
- upload-image/index.ts:81: `MADI_JWT_SECRET ?? JWT_SECRET` fallback — 마이그레이션 후 단일 키 통일.

**PWA (3)**
- madi-parent-pages.js:628-636: 푸시 구독 DELETE→POST 2단계 비원자적(현 롤백은 적절) — 장기적으로 upsert 단일 엔드포인트.
- manifest.json:16-24: 아이콘 7개 경로 유효(정상). 미참조 icon-1024.png 보관본 확인만 권고.
- madi-system.js:344-351: Blob URL 폴백 SW의 CACHE_NAME이 로드시각 기준 매번 변동 — 폴백 캐시 잦은 무효화(로컬 한정, 저우선).

**UI/UX (5)**
- madi-parent-home.js:141-144: 자녀 전환 칩 min-height:40px → 44px 상향.
- madi-dashboard.js:212,254-600: 장식 화살표(→) SR 음독 가능 — `aria-hidden` span 분리 또는 aria-label 부여.
- madi-quick.js:402: 토글 비활성 트랙 `#cbd5e1` 인라인 하드코딩 — 다크모드 떠보임, CSS 변수화.
- madi-parent-home.js:796: 온보딩 안내 박스 `#f0fdfa/#0f766e` 하드코딩 — 다크모드 톤 불일치, 테마 변수화.
- madi-quick.js:626,800: 비동기 진행이 SR 비가시 — `aria-live="polite"`/`aria-busy` 부여(선택적).

### INFO (32건 — 양호 사항, 기준선 확인)

전 도메인에서 핵심 보안·구조 불변식이 견고함을 확인했습니다. 대표 항목:
- **보안**: anon key/service_role/JWT secret 하드코딩 0건, 토큰 in-memory+sessionStorage(localStorage 금지), 모든 DB 접근 supaFetch→Edge 경유, eval/setTimeout(string) 미사용, PostgREST 필터 encodeURIComponent.
- **권한**: admin.html 클라1차+서버2차 재검증+visibility 차폐, escalation 방어 완비(role/permissions/password 서버 강제), parent READ 격리·center_id 강제 주입, author_id/author_role JWT 강제.
- **에러 핸들링**: supaFetch 102곳 .catch 누락 0건, JSON.parse 전수 try-catch, fire-and-forget 의도 명시.
- **성능**: supaCache 5분 TTL+해싱+무효화, H6 render-skip 최적화, 타이머·리스너 재등록 가드.
- **Edge**: verifyJwt alg 강제·exp 필수, 비용 엔드포인트 failClosed rate limit, 에러 응답 generic 래핑, cron 상수시간 비교.
- **PWA**: CACHE_NAME 자동 bump(초단위 충돌회피), controllerchange 작성중 유실방지 배너, activate 구캐시 정리, 푸시 origin 검증.
- **컨벤션**: arrow/class/let/const/async 위반 0건, console.log 0건(가드된 warn/error만), ID camelCase, 중복 전역함수 0건.

---

## 도메인별 건강도 점수 (100점 만점)

| 도메인 | 점수 | 한줄 평가 |
|--------|------|-----------|
| 보안 (security) | 90 | CRITICAL/HIGH 0. 클라 필터 1건만 서버 강제 확인 필요, 나머지 정밀 통제 완비. |
| DB 스키마 일관성 | 98 | 컬럼 오기·400 유발 0건. flat child_id 비활성 컬럼 1건은 결함 아님. |
| 코딩 컨벤션 | 100 | 4대 금지 패턴·console.log·키 하드코딩 모두 0건. 완벽 준수. |
| 역할·권한 분기 | 92 | 서버 경계 완비. 클라 가드 일관성 LOW 3건(보안 무영향). |
| 에러 핸들링 | 90 | unhandled rejection 0건. 사용자 친화 메시지 규약 이탈 LOW 3건. |
| 성능·중복 | 93 | 캐시·render-skip·타이머 가드 견고. 룩업맵 미세 중복 LOW 3건. |
| UI/UX | 78 | 대시보드 키보드·SR 접근 불가 + 모바일 터치타겟 미달이 가장 큰 부채. |
| Edge Functions | 85 | JWT·rate limit·에러 래핑 견고. fail-open 정책·무솔트 해시 윈도우 MEDIUM 3건. |
| PWA/SW/IndexedDB | 86 | CACHE bump·업데이트 UX 견고. IDB 연결 정리·offline.html 자가복구 MEDIUM 2건. |
| 라이브 프로브 | N/A | 자격증명 미설정으로 생략 — 라이브 DB 무결성 미검증(추측 미기재). |

---

## 권고 수정 순서 (로드맵)

**1순위 — 접근성 (UI/UX, 가장 큰 사용자 영향·법적 노출)**
1. madi-dashboard.js: Teacher/Admin 대시보드 클릭 `<div>`(277,321,364-374,619,783-798)에 `role="button" tabindex="0" aria-label + onkeydown` 적용 — parent-home.js:339 패턴 복제. 키보드·SR 사용자의 핵심 네비게이션 복구.
2. index.html:2072-2073 + madi-quick.js:361: 모바일 우선 화면 보조 버튼 `min-height:44~48px` 일괄.

**2순위 — 서버 방어심도 (Edge Functions, 보안 잔존 위험)**
3. parent-auth/index.ts:44-97: 메모리 폴백 시 분당 한도 하향 또는 연속 RPC 실패 시 503 — 전화번호 enumeration 완화.
4. _shared/auth.ts: ai-proxy/change-password `allowNullOrigin` 재검토(불필요 시 false), 민감 READ `failClosed` 검토 + ARCHITECTURE.md 박제.
5. api/index.ts:946-978: staff 가입 경로 서버 즉시 bcrypt로 통일.
6. totp/index.ts:87-107: 인라인 세션 검증 → `requireFreshSession(failClosed:true)`.

**3순위 — PWA 견고성 + 클라 일관성 (저위험·코드 품질)**
7. madi-deploy.js:35-46: `_loadFolderHandle` onerror에 `db.close()` 추가.
8. sw.js:22-28: activate에 offline.html 자가복구 c.add.
9. 클라 가드 일관성 묶음: madi-board.js:74 center_id 가드, madi-child-detail.js:686 `isAdminRole`, madi-home.js:149/190 진입부 role 가드.
10. 에러 메시지 규약: madi-parent-pages.js:446/529, madi-auth.js:156 → `_userErrMsg` 경유.
11. 성능 미세: madi-schedule.js:345/827 룩업맵 통일.

---

## 잘 구현된 부분 (Keep)

1. **서버 권위 보안 모델 일관성** — 모든 DB 접근이 supaFetch→Edge 프록시 경유이며, center_id 강제 주입·parent READ 격리·escalation 차단·author 위장 차단이 서버에서 권위적으로 강제됩니다. 클라이언트 가드는 일관되게 UX 보조로만 동작합니다.
2. **토큰·비밀 관리** — JWT는 in-memory+sessionStorage 한정(localStorage 금지), anon key/service_role/JWT secret 소스 하드코딩 0건, PII 캐시 키 localStorage 차단. verifyJwt가 alg HS256 강제·exp 필수로 단일화.
3. **방어적 에러 처리 규약** — supaFetch 102곳 전수 .catch, JSON.parse 전수 try-catch+안전 폴백, showError/_userErrMsg로 서버 원문 비노출, fire-and-forget 의도 주석 명시.
4. **PWA 캐시·업데이트 UX** — CACHE_NAME 초단위 자동 bump(같은 분 2회 커밋 충돌 회피), 작성 중 세션·평가 유실 방지 배너, controllerchange 무한 새로고침 방지, activate 구캐시 정리.
5. **성능 인프라** — supaCache 5분 TTL+djb2 해싱+테이블별 쓰기 무효화, H6 render-skip(시그니처 비교로 무변경 폴링 시 전면 재렌더 스킵), 타이머·리스너 재등록 전 정리 가드.

---

**총평**: 베타 출시를 차단하는 CRITICAL/HIGH는 0건이며, 코드 컨벤션·에러 처리·서버 보안 모델은 매우 견고합니다. 남은 부채는 ①대시보드 접근성(키보드/SR)과 모바일 터치타겟, ②서버 fail-open 정책·무인증 enumeration 완화 같은 defense-in-depth, ③PWA 자원 정리 견고성에 집중되어 있습니다. 라이브 프로브는 자격증명 미설정으로 미수행되었으므로, 실DB↔SCHEMA.md 대조가 필요하면 `MADI_PROBE_USER`/`MADI_PROBE_PW` 설정 후 재실행을 권고합니다.
