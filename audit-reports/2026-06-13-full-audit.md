# 전수감사 리포트 (2026-06-13)

**종합 평가**: 프로덕션 견고함. 즉시 위험 0건, 잔여는 전부 하드닝·일관성 부채로 다음 스프린트 정리 권장.

---

# 아이마디 APP 전수점검 결과 리포트

## 전체 요약

이번 회차는 정적 9개 도메인 전수감사 + 라이브 프로브로 구성되었으며, 라이브 프로브는 자격증명 미설정으로 SKIP되어 라이브 DB 무결성 점검은 이번 회차에서 수행되지 않았습니다(추측 보고 없음).

### 심각도별 분류표

| 심각도 | 건수 | 비고 |
|--------|------|------|
| CRITICAL | 0 | 즉시 수정 필수 항목 없음 |
| HIGH | 0 | 스프린트 내 긴급 항목 없음 |
| MEDIUM | 14 | 다음 스프린트 정리 권장 |
| LOW | 28 | 일관성·하드닝 부채 |
| INFO | 24 | 긍정 확인 + 정보성 기록 |
| **합계** | **66** | (라이브 프로브 SKIP 1건 포함) |

### 도메인별 심각도 분포

| 도메인 | C | H | M | L | I |
|--------|---|---|---|---|---|
| 보안 (XSS/주입/시크릿/인증) | 0 | 0 | 1 | 3 | 4 |
| DB 스키마 일관성 | 0 | 0 | 0 | 0 | 2 |
| 코딩 컨벤션 | 0 | 0 | 0 | 0 | 3 |
| 역할·권한 분기 | 0 | 0 | 1 | 3 | 2 |
| 에러 핸들링 | 0 | 0 | 0 | 4 | 4 |
| 성능·중복 | 0 | 0 | 3 | 6 | 2 |
| UI/UX | 0 | 0 | 3 | 5 | 2 |
| Edge Functions | 0 | 0 | 3 | 4 | 3 |
| PWA/SW/IndexedDB | 0 | 0 | 3 | 3 | 3 |
| 라이브 프로브 | 0 | 0 | 0 | 0 | 1 (SKIP) |

### 즉시 조치 필요 항목 수: **0건**

CRITICAL·HIGH 결함은 한 건도 발견되지 않았습니다. 대장님의 코드베이스는 서버 측 권한 경계, XSS 방어(escHtml/jsArg + ESLint no-unsanitized), 스키마 단일 정본 규율이 견고하게 정착되어 있습니다. MEDIUM 이하는 모두 "일관성·방어심층·하드닝 부채"이며 실 취약점은 아닙니다.

---

## 1. CRITICAL (즉시 수정 필수)

**해당 없음.** CRITICAL 등급 결함이 발견되지 않았습니다.

---

## 2. HIGH (이번 스프린트 내 수정)

**해당 없음.** HIGH 등급 결함이 발견되지 않았습니다.

---

## 3. MEDIUM (다음 스프린트)

### 보안
1. **[index.html:24, admin.html:20 CSP meta]** CSP `script-src` 에 `'unsafe-inline'` 포함 — 인라인 핸들러(226+ onclick)·인라인 `<script>` 때문. escHtml/jsArg 갭이 ESLint를 통과할 경우 인젝션 스크립트가 실행될 수 있는 최대 잔여 XSS 노출면. → 중기적으로 data-action 위임·외부 스크립트로 이관 후 nonce/hash 기반 script-src로 전환. 단기: ESLint no-unsanitized 게이트 유지 + 신규 인라인 onclick 금지.

### 역할·권한
2. **[madi-iep.js:155 suggestHomeActivities, :782 detectStagnation]** 두 AI 함수만 `canDo('useAI')` 클라이언트 가드 누락 — 다른 모든 AI 진입점은 가드 존재. 서버 ai-proxy가 403으로 막아 보안 침해는 없으나, useAI 꺼진 선생님이 누르면 친절한 차단 대신 403 에러 토스트를 받음. → 두 함수 시작부에 `if (typeof canDo === 'function' && !canDo('useAI')) { showToast('⚠️ AI 기능 사용 권한이 없습니다'); return; }` 추가.

### 성능·중복
3. **[madi-schedule.js openSchedModal ~592, openEditSchedModal ~745]** loadTeacherList·loadStaffMgmtList가 동일 madi_users 쿼리를 select/order 미세 차이로 각자 fetch → supaCache 미스 가능. → 쿼리 문자열 완전 일치 또는 _teacherList SSOT 캐시로 통합.
4. **[madi-children.js renderStaffStats ~562, showStaffTrend ~678, renderSettlement ~364]** 정산/통계 렌더가 sessionDB/scheduleDB 풀스캔을 각자 반복. 특히 showStaffTrend는 6개월 × O(N) 스캔. → teacher 세션 1회 필터 후 ym→count 맵 집계로 O(N) 전환.
5. **[madi-schedule.js renderMonthGrid/WeekGrid/DayGrid 등 5개 함수]** childById 룩업 맵을 5개 렌더 함수가 독립 재구축, 연쇄 호출 시 2회 빌드. → loadDBFromSupabase/saveChildren 시점에 모듈 레벨 `_childByIdCache` 1회 빌드 후 공유.

### UI/UX
6. **[madi-parent-pages.js:137 '보호자님께', :799 '선생님 답글']** 인라인 하드코딩 밝은 그라데이션 배경+어두운 텍스트 → 다크모드 오버라이드 불가. 베타 다크모드 복원 시 가독성 붕괴. → CSS 클래스(.parent-msg-box 등) 추출 + body.dark-mode 오버라이드.
7. **[madi-dashboard.js:784/789/793/799 dp-tl-av]** 관리자 대시보드 빠른 액션 아이콘 인라인 파스텔 배경 하드코딩, 다크 오버라이드 없음. → 의미 클래스 추출 후 다크 오버라이드 추가.
8. **[madi-dashboard.js:662 admin SVG, madi-parent-home.js:544/618 parent SVG]** 발달/추이 라인차트 SVG가 role/aria-label 없이 렌더 → 스크린리더 사용자가 핵심 지표 인지 불가(접근성 위반). → 동적 요약 aria-label 부여 또는 SVG aria-hidden + 요약 셀 캡션 노출.

### Edge Functions
9. **[notify-test/index.ts:59]** admin 푸시테스트 rate limit이 fail-OPEN — RPC 다운 시 3/분·10/시간 캡 제거, 센터 전체 학부모에 Web Push(FCM/APNs 비용·악용 벡터). → `{ failClosed: true }` 추가.
10. **[upload-image/index.ts:127]** 업로드 rate limit(20/분, 100/시간) fail-OPEN — RPC 실패 시 무제한 5MB Storage 쓰기 허용. → `{ failClosed: true }` 추가.
11. **[api/index.ts:362-371 vs 430]** madi_audit_log POST 분기가 parent default-deny 게이트보다 먼저 실행되어 parent JWT가 감사 로그 POST 가능(allow-list 우회). 영향 제한적(actor_id/role/center_id 강제, action 화이트리스트, 길이 캡 → 최악도 자기 로그 스팸). → parent를 client_error만 허용하거나 분기에서 단락.

### PWA/SW
12. **[madi-deploy.js:72-182 SW_LINES]** sw.js 전체를 수작업 복제한 SW_LINES 배열의 동기화를 강제하는 자동 검사 없음 — sw.js 편집 시 폴백 SW가 stale 로직 배포(스키마 정본 갈라짐과 동일 패턴). → tools/check-sw-sync.js 추가해 pre-commit에서 diff 검사.
13. **[.githooks/pre-commit:24-31]** CACHE_NAME 자동 bump이 PC마다 수동 설치 필요한 로컬 훅에만 존재 — 훅 미설치/웹 커밋/--no-verify 시 캐시 무효화 누락(단일 인적 의존점). → GitHub Action으로 "정적 자산 변경 시 CACHE_NAME 미변경이면 실패" CI 가드 추가.
14. **[madi-deploy.js:75-78 SW_BUILD]** 폴백 CACHE_NAME이 클라이언트 시계 분 단위(%H%M)로 생성 → 같은 분 내 충돌·정방향/역방향 이동으로 activate 단계 캐시 정리 무력화 가능(실 sw.js는 초 단위 %H%M%S). → 초 단위 일치 또는 빌드 상수 기반 결정론적 생성.

---

## 4. LOW / INFO

### LOW (28건 — 일관성·하드닝)

**보안**
- madi-auth.js:125/128/176/179 — JWT가 sessionStorage('madi_sess')에 iOS Safari ITP 폴백으로 저장, XSS 탈취 가능(문서화된 의도적 트레이드오프). → 토큰 TTL 단축·로그아웃 정리 확인.
- madi-child-detail.js:363-366 — cascade-delete가 `id=in.()` ids에 encodeURIComponent 미적용(유일한 미인코딩 PostgREST 경로). → `ids.map(encodeURIComponent).join(',')`.
- madi-core.js:463/board.js/home.js — center_id 필터 일부 encodeURIComponent 누락(home.js:742는 인코딩 — 파일 간 불일치). → 전 경로 인코딩 통일.

**역할·권한**
- madi-system.js:163-180 — 직원추가 시 클라가 role 값 그대로 POST(서버 강제 teacher 강등으로 실 취약점 없음). → index.html 모달도 비-superadmin에게 admin 옵션 DOM 제거.
- madi-home.js:473-474 vs 492 — 사이드바 가시성(isSuper) vs showTab 가드(admin+super) 임계값 불일치. → getRoleFlags 단일 출처로 통일.
- madi-board.js:184/389/598 — 게시판 삭제가 superadmin+작성자만(admin 센터 모더레이션 불가, 과소 허용=안전 방향). → 의도면 주석 명문화.

**에러 핸들링**
- madi-home.js:755 loadNotices — 서버 원문 e.message UI 노출(_userErrMsg 규약 위반). → `_userErrMsg(e, '공지 로드')`.
- madi-children.js:757, madi-iep.js:721 — 차트 로드 실패 시 원문 토스트(복붙). → `_userErrMsg(e, '차트 로드')`.
- madi-iep.js:577 — 차트 렌더 catch 원문 노출. → _userErrMsg 경유.
- madi-report.js:441 generateSIReport — AI 보고서 catch 원문 노출 가능. → madi-ai.js 패턴으로 통일.

**성능·중복**
- madi-children.js 외 — 목록 렌더 전체 innerHTML 교체(diff 없음, 현 규모 허용). → home.js _lastNoticesJson 해시 비교 적용 검토.
- madi-home.js loadCenterInfo — catch에서 showToast+console.warn 둘 다(토스트 노이즈). → silent console.warn만.
- madi-child-detail.js:87-97 getLastSessionForChild — 호출마다 풀스캔+정렬(현 단건 호출 무해).
- madi-schedule.js:336/402/846 — 주간/일간 뷰 중첩 필터 O(T·D·N)(월간은 schedByDate 최적화됨). → 동일 맵 패턴 적용.
- madi-app.js:512-526 updateHeaderClock — 60초마다 scheduleDB 풀스캔+정렬. → 오늘 일정 캐시 후 nowMin 비교만.
- madi-children.js renderDailyService 등 — 대형 onclick 인라인 행마다 생성. → data-action 위임·CSS :hover 전환.

**UI/UX**
- index.html:1215 headerQuickBtn — 인라인 color:#1a1a1a 하드코딩, 다크 미대응, min-height 32px(<44px). → var(--text) 전환·CSS 클래스화.
- madi-parent-home.js:289-291/568-569 — 단위 텍스트 인라인 #94a3b8(토큰 우회). → var(--text2).
- madi-parent-pages.js:681-690 loadParentObservations — 아동 미연결 시 obs 섹션 빈 채 잔존(onNoChild 콜백 없음). → 명시적 빈 상태 처리.
- madi-parent-home.js:382-436 — 데드/스텁 코드(_renderParentWeekSessions 미사용, _loadParentTeacherMessages 항상 빈 반환). → 미사용 제거·'준비 중' 명시.
- madi.css:1711/1723 — 선생님별 활동 표가 360px에서 이름 영역 ~180px로 압박. → stat 셀 38px 축소 또는 2줄 스택.
- madi-quick.js:400-404 — 학부모 공개 토글 인라인 background:#cbd5e1(다크 미대응). → CSS .switch .slider 위임.

**Edge Functions**
- _shared/auth.ts:131-186/275-310 — requireFreshSession·checkRateLimit 기본 fail-OPEN(opt-in 시만 fail-closed). → write/cost 엔드포인트 기본 failClosed 전환 또는 lint 가드.
- login/index.ts:83-105 — rate limit 키가 스푸핑 가능한 IP 헤더 기반(계정 락아웃이 1차 방어). → 전역 username-독립 시도 카운터 검토.
- api/index.ts:820-845 — madi_children에 owning-teacher 컬럼 부재로 'viewOtherChildren' 서버 시행 불가(센터 격리는 유효, 센터 내 교사 격리는 UI 전용). → 필요 시 assigned_teacher_id 컬럼 추가.
- totp/index.ts:228-242 — totp_last_step 컬럼 부재 시 replay 검사 비활성(pre-migration 그레이스). → 운영 마이그레이션 적용 확인.
- ai-proxy/index.ts:95-117 — env var 미설정 시 madi_settings.api_key(평문) 폴백 — 테넌트 읽기 가능 테이블의 평문 LLM 키. → ANTHROPIC_API_KEY Edge secret 설정·폴백 제거.

**PWA/SW**
- sw.js:13-21 — install 시 offline.html만 precache(첫 설치 직후 오프라인 시 셸 대신 오프라인 페이지). → 핵심 셸 precache 검토(또는 의도 문서화).
- madi-parent-pages.js:628-636 — 푸시 구독 DELETE→POST 비원자적(중간 실패 시 고아 구독 가능, 롤백 unsubscribe도 무음 실패 가능). → Edge Function 단일 트랜잭션 검토.
- madi-deploy.js:35-45 _loadFolderHandle — db.transaction() 동기 throw 시 reject 경로 없어 promise 영구 pending 가능. → try/catch 후 resolve(null)/reject(e).

### INFO (24건 — 주요 긍정 확인)

- **보안**: eval/new Function/setTimeout(string) 0건, postMessage 수신기 0건, anon key/service_role/JWT secret 하드코딩 0건, 모든 raw fetch가 EDGE_URL 경유, innerHTML 싱크 전부 escHtml 보호, 클라 role 체크는 UI 전용·서버가 최종 경계.
- **DB 스키마**: SCHEMA.md 단일 정본 규율 완벽 준수, status 컬럼 미주입·audit_log actor_role/row_id 정확(트랩 통과). (참고: madi_schedules의 flat child_id는 미사용, 읽기는 data->>childId.)
- **코딩 컨벤션**: arrow/class/let/const/async/console.log 운영 코드 0건. (단, madi-icons.js가 CLAUDE.md 파일 구조 표에 미등재 — 문서 드리프트.)
- **권한**: 서버 api 프록시가 center_id 강제·role 변경 superadmin 전용·permissions 상승 가드·parent 화이트리스트로 견고. canDo() fail-closed.
- **에러 핸들링**: 빈 catch는 전부 의도적 fire-and-forget, 미보호 JSON.parse 0건, 네트워크 오류 시 로딩 복구 패턴 견고.
- **성능**: supaCache parse-per-hit는 캐시 오염 방지 의도, _bpCacheSig 폴링 렌더스킵 H6 최적화 모범 사례.
- **Edge**: CORS fail-closed·canonical origin, notify-tomorrow CRON_SECRET 상수시간 비교·fail-closed, deploy-fn --no-verify-jwt 강제.
- **PWA**: push 핸들러 origin 검증·방어적 파싱, activate 캐시 정리 정확, manifest 아이콘 전부 존재.

---

## 도메인별 건강도 점수 (100점 만점)

| 도메인 | 점수 | 한줄 평가 |
|--------|------|-----------|
| DB 스키마 일관성 | **98** | 단일 정본 규율 완벽 준수, 트랩 전부 통과 — 사실상 무결. |
| 코딩 컨벤션 | **97** | var/function/.then() 일관, 위반 0건. madi-icons.js 문서 등재만 누락. |
| 에러 핸들링 | **88** | JSON.parse·빈 catch 안전. 원문 노출 4건(_userErrMsg 우회)만 정리하면 만점권. |
| 역할·권한 분기 | **86** | 서버 경계 견고. 클라 가드 임계값 불일치·useAI 가드 누락 등 일관성 부채. |
| 보안 | **85** | XSS·시크릿·주입 클린. CSP unsafe-inline이 유일한 구조적 잔여 노출. |
| PWA/SW/IndexedDB | **82** | push/activate 견고. SW_LINES 동기화 미강제 + 캐시 bump 인적 의존이 약점. |
| Edge Functions | **82** | 권한·CORS·CRON 견고. fail-OPEN rate limit 3건 + parent audit 누수가 정리 대상. |
| UI/UX | **80** | 터치 타겟·역할 분기 양호. 다크모드 인라인 색 부채 + SVG 접근성 누락. |
| 성능·중복 | **80** | 폴링 H6·supaCache 모범. 룩업맵 중복 빌드·풀스캔 반복이 스케일 부채. |
| **종합** | **86** | **프로덕션 견고. 즉시 위험 0, 잔여는 전부 하드닝·일관성 부채.** |

---

## 권고 수정 순서 (로드맵)

### 1순위 — Edge 가용성·악용 방어 (서버, 저비용 고효과)
- **notify-test/index.ts:59 + upload-image/index.ts:127** — `{ failClosed: true }` 추가 (각 1줄). RPC 다운 시 푸시 폭주·Storage 악용 캡 유지.
- **api/index.ts:362-430** — parent JWT의 madi_audit_log POST를 client_error만 허용하도록 단락.
- 배포 시 `--no-verify-jwt` 필수, 엔드포인트 직접 호출로 동작 확인.

### 2순위 — 에러 일관성 + 권한 UX (클라이언트, 저위험 정리)
- **madi-home.js:755 / madi-children.js:757 / madi-iep.js:577,721 / madi-report.js:441** — 전부 `_userErrMsg(e, 라벨)` 경유로 통일, 원문은 console.warn.
- **madi-iep.js:155,782** — suggestHomeActivities·detectStagnation에 canDo('useAI') 가드 추가.
- **madi-system.js** — index.html 직원추가 모달에 비-superadmin admin 옵션 DOM 제거.

### 3순위 — PWA 드리프트 차단 (CI/훅 하드닝)
- **tools/check-sw-sync.js 신설** + .githooks/pre-commit 연동 — SW_LINES ↔ sw.js diff 검사.
- **GitHub Action 추가** — 정적 자산 변경 시 CACHE_NAME 미변경이면 빌드 실패.
- **madi-deploy.js:75-78** — 폴백 CACHE_NAME 초 단위(%H%M%S) 일치.

### 4순위 — 성능 스케일 부채 (센터 규모 증가 대비)
- **madi-schedule.js** — _childByIdCache 모듈 캐시 + 주간/일간 뷰 schedByDate 맵 패턴.
- **madi-children.js** — showStaffTrend O(N) 집계 맵 전환.
- **madi-app.js** — updateHeaderClock 오늘 일정 캐시.

### 5순위 — 보안 하드닝 부채 (중장기)
- **CSP unsafe-inline 제거** — data-action 위임 이관 완료 후 nonce/hash 기반 전환(226 onclick 점진 이관 전제).
- **encodeURIComponent 통일** — madi-child-detail.js:363, center_id 필터 전 경로.
- **ai-proxy** — ANTHROPIC_API_KEY Edge secret 설정, madi_settings.api_key 평문 폴백 제거.

### 6순위 — UI/UX 다크모드 복원 전 일괄 점검
- 인라인 하드코딩 색(parent-pages·dashboard·quick·index.html headerQuickBtn) → CSS 클래스 + body.dark-mode 오버라이드.
- SVG 차트 aria-label 부여 (dashboard·parent-home).
- 데드 코드(_renderParentWeekSessions) 제거, '선생님 메시지' 패널 '준비 중' 처리.

### 별도 — 라이브 프로브 미수행
- MADI_PROBE_USER / MADI_PROBE_PW 환경변수 설정 후 `node tests/live-probe.js` 재실행 필요. 라이브 DB ↔ SCHEMA.md 일치·Edge 계약 점검은 이번 회차 미수행. 감사 런북에 환경변수 주입 단계를 명시해 향후 SKIP 공백 방지 권장.

---

## 잘 구현된 부분 (Keep)

1. **서버 측 권한 경계가 진짜 보안 경계** — api 프록시가 service_role로 RLS를 우회하되 모든 비-superadmin에 center_id 강제 주입, role 변경 superadmin 전용, 회원가입 role 강제 teacher, parent 테이블 화이트리스트+읽기전용+child_id 소유 검증. 클라 권한 분기는 UX 보조일 뿐임을 일관되게 유지.

2. **XSS 다층 방어가 정착** — escHtml/jsArg 두 맥락 차단 + ESLint no-unsanitized 게이트 + smoke 박제. eval/new Function/string-setTimeout 0건, postMessage 수신기 0건. innerHTML 싱크 전부 escHtml로 내부 구성.

3. **스키마 단일 정본(SCHEMA.md) 규율** — 과거 사본 갈라짐 사고 이후 status 컬럼 미주입·audit_log actor_role/row_id 정확 등 트랩을 전부 통과. 코드베이스가 정본 규율을 모범적으로 준수.

4. **폴링 렌더스킵 H6 최적화** — _bpCacheSig djb2 해시 시그니처 비교로 무변경 시 전체 렌더 스킵, _supaCacheSet 시점 1회 해싱으로 히트마다 재해싱 비용 제거. 30초 폴링의 DOM 재구축 비용을 적절히 제거한 모범 사례.

5. **Edge Functions 방어 설계** — CORS fail-closed(canonical origin 반영), notify-tomorrow CRON_SECRET 상수시간 비교+fail-closed, 자체 발급 JWT(HS256·exp 필수·alg 고정), deploy-fn --no-verify-jwt 강제. 게이트웨이가 아닌 함수 자체 인증으로 일관.
