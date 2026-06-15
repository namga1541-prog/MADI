# 전수감사 리포트 (2026-06-16)

**종합 평가**: CRITICAL 0건 / HIGH 2건(IEP 삭제 롤백 누락·배포버튼 FOUC) / 성숙도 88점 — 즉시 위협 없으나 데이터 유령 부활 2건은 이번 스프린트 내 수정 필요

---

# 아이마디 APP 전수점검 결과 리포트

## 전체 요약

이번 전수점검은 정적 9개 도메인(보안·DB스키마·코딩컨벤션·RBAC·에러핸들링·성능·UI/UX·Edge Functions·PWA) + 라이브 프로브로 수행되었습니다. **CRITICAL 0건으로, 운영을 즉시 위협하는 결함은 없습니다.** 다만 데이터 유령 부활을 일으키는 HIGH 결함 2건은 이번 스프린트 내 수정이 필요합니다.

| 심각도 | 건수 | 비고 |
|--------|------|------|
| 🔴 CRITICAL | **0** | 즉시 조치 항목 없음 |
| 🟠 HIGH | **2** | IEP 삭제 롤백 누락 · 배포버튼 FOUC |
| 🟡 MEDIUM | **9** | 권한 격리·다크모드·배치저장·cross-tenant 등 |
| 🔵 LOW | **20** | 트레이드오프·정합성·미세 UX |
| ⚪ INFO | **23** | 양호 확인(조치 불필요) |
| **합계** | **54** | (결함성 31 / 양호확인 23) |

- **즉시 조치 필요(HIGH 이상)**: 2건
- **라이브 프로브**: 자격증명 미설정으로 SKIP — 실 DB 무결성·SCHEMA↔실DB 대조는 미수행(아래 별도 안내)

---

## 1. CRITICAL (즉시 수정 필수)

**해당 없음.** 9개 도메인 전반에서 즉시 데이터 손실·권한 우회·비밀 노출로 이어지는 결함은 발견되지 않았습니다. 서버 프록시(/api)의 다층 방어, XSS 프리미티브(escHtml/jsArg/isSafeUrl), 비밀 관리(service_role 서버 전용)가 견고하게 작동하고 있습니다.

---

## 2. HIGH (이번 스프린트 내 수정)

### H-1. IEP 삭제가 낙관적 처리 — 실패 시 롤백 없음 → 데이터 유령 부활
**[madi-ai.js:588-614 deleteIEPRecord]**

DELETE 응답을 기다리지 않고 iepDB에서 먼저 제거 → saveIEP() → render → '🗑️ 삭제됨' 토스트를 무조건 표시한 뒤, `.catch`에서 '❌ 삭제 실패' 토스트만 띄우고 **메모리 롤백을 하지 않습니다.** 이로 인해:
- DELETE 실패 시 '삭제됨'과 '삭제 실패' 토스트가 **동시에** 떠 모순된 신호
- saveIEP()는 upsert라 부재 행을 지우지 못해 **서버에 IEP 행이 그대로 남고, 다음 loadDBFromSupabase 때 삭제 기록이 되살아남(유령 부활)**

이 패턴은 자매 경로인 `deleteAssessment`(madi-assessment.js:860-863)에서 이미 회귀로 적발돼 '성공 시에만 제거/렌더/토스트'로 수정된 **바로 그 안티패턴**입니다.

→ **권고**: `deleteAssessment`와 동일하게 supaFetch DELETE를 게이트로 삼아 `.then` 안에서만 iepDB 제거·render·토스트를 실행하고, `.catch`에서는 메모리/UI를 건드리지 않고 실패 토스트만 표시. 연동 부수문제로 madi-ai.js:593의 무의미한 saveIEP() 호출(LOW)도 함께 제거 또는 `.then` 내부 이동.

### H-2. 헤더 '🚀 배포' 버튼 기본 숨김 누락 → 전 역할에 400ms 깜빡 노출(FOUC)
**[index.html:1254]**

바로 아래 '⚡ 빠른 기록' 버튼(1256줄)은 `style='display:none;...'`으로 기본 숨김인데, 배포 버튼만 누락됐습니다. applyPermissions가 init()에서 setTimeout 400ms 뒤 실행되므로, **로그인 직후 400ms 동안 teacher/parent 포함 모든 역할에게 배포 버튼이 깜빡 노출**됩니다. 운영 웹(github.io)에서도 발생해 권한 혼란을 유발합니다.

→ **권고**: 1254줄 인라인 style 맨 앞에 `display:none;` 추가(빠른기록 버튼과 동일). JS 게이팅이 표시를 책임지므로 기본 숨김이 안전합니다(no-flash). **1줄 수정으로 해결 — 최우선 권장.**

---

## 3. MEDIUM (다음 스프린트)

| # | 위치 | 요약 |
|---|------|------|
| M-1 | api/index.ts:826-855 + madi-child-detail.js / madi-chat.js | **teacher 'viewOtherChildren' 격리가 클라이언트 전용.** madi_children에 담당교사 컬럼이 없어 같은 센터 teacher가 직접 API 호출 시 센터 내 전 아동(임상 PII) 조회 가능. 센터 간 격리는 보장됨. (보안·RBAC 도메인 중복 보고 — 동일 사안) |
| M-2 | madi-app.js:467 | **showToast undo 분기에 `<\span>` 오타**(역슬래시). 올바른 `</span>` 로 수정. 삭제 후 실행취소 토스트 마크업 깨짐 |
| M-3 | madi-parent-pages.js:799-801, 137-139 | 학부모 답글/포트폴리오 카드 인라인 색 하드코딩 → 다크모드 미대응(눈부심). 클래스화 또는 CSS 변수로 교체 |
| M-4 | madi-parent-home.js:796-797 | 학부모 온보딩 안내 박스(#f0fdfa) 다크모드 미보정 |
| M-5 | index.html:1254, 1256 | 헤더 액션 버튼 min-height 32px → 모바일 터치 타겟 권고(44px) 미달 |
| M-6 | madi-schedule.js:757 | **반복 일정 다건 생성 시 항목마다 개별 POST**(약 50회 동시 라운드트립). _saveCollection 배치 패턴 재사용 권장. 부분 실패 위험 |
| M-7 | madi-chat.js:306, madi-children.js:103, madi-schedule.js:757/1005 | **저장 fire-and-forget + 무조건 성공 토스트.** 온라인 서버 거부(403/409/500) 시 ❌/✅ 토스트 동시 노출. `.then(ok)` 게이트로 수정 |
| M-8 | api/index.ts madi_settings (GLOBAL_TABLES) | **cross-tenant read**: 센터 A admin이 전 센터 settings 조회 가능. 현재 데이터 민감도 낮으나 신규 설정 추가 전 격리 정책 확정 필요 |
| M-9 | upload-image/index.ts:81 | upload-image만 JWT_SECRET 폴백 체인 사용(타 함수는 MADI_JWT_SECRET 단일). secret 불일치 시 업로드만 401 가능 |
| M-10 | sw.js install / madi-deploy.js:35-46 / madi-parent-pages.js:611-646 | PWA: ① offline.html 첫 설치 실패 시 영영 미캐시 ② _loadFolderHandle tx.onerror 누락 → Promise hang 가능 ③ 푸시 구독 오프라인 부분 실패 무재시도 |

---

## 4. LOW / INFO

**LOW (20건, 대부분 트레이드오프·정합성·미세 UX):**
- **보안**: TOTP 일반 문자열 비교(타이밍, rate limit으로 완화) · sessionStorage JWT 폴백(iOS ITP 대응, 의도된 트레이드오프) · PostgREST DSL 남용 여지(다층 방어로 제한)
- **DB스키마**: `madi_schedules.child_id` 죽은 컬럼(쓰기·읽기 모두 JSONB 경로만 사용 — SCHEMA.md 주석 또는 child_id 채우기)
- **코딩컨벤션**: Supabase URL 하드코딩(비밀 아님 — 컨벤션 문구 정밀화 권장)
- **RBAC**: savePermissions 클라 가드와 서버 정책 불일치(다른 admin 권한 토글) · switchTab parent 가드 누락(UI 혼선 수준, 데이터는 서버 필터됨)
- **에러핸들링**: deleteIEPRecord saveIEP 무의미 호출(H-1 연동) · changeSchedStatus fire-and-forget(M-7 연동) · pushErrorLog 사일런트 실패(모니터링 보강)
- **성능**: populateChildSelects 탭전환마다 재실행 · getUnwrittenSessions O(S×N) · _teacherList stale 캐시
- **UI/UX**: 대시보드 차트 원 fill='white' 다크 부조화 · 빠른기록 버튼 flex-wrap 미지정 · 푸시 토글 로딩 공백 · 학부모 홈 보조텍스트 색 하드코딩
- **Edge/PWA**: viewOtherChildren(M-1 중복) · notify-tomorrow CRON_SECRET 단일 방어선 · requireFreshSession/checkRateLimit READ fail-open · pre-commit CACHE_NAME sed 정규식 취약 · manifest id 절대경로 · skipWaiting 자동 reload 입력 유실 가능 · 푸시 토글 인라인 onclick

**INFO (23건, 양호 확인 — 조치 불필요):**
동적 코드 실행(eval) 0건 · XSS 프리미티브 견고 · 비밀 하드코딩 0건 · 서버 RBAC 다층 강제 · admin.html 접근 가드 모범 · dinosau username 우회 0건 · ES2015+ 금지문법 0건 · console.log 0건 · 전역함수 중복 0건 · JSON.parse 미가드 0건 · supaCache/렌더스킵 견고 · CORS/JWT 검증 모범 · service_role 서버 전용 · rate limiting 포괄적 · 입력검증 철저 · 캐시 정리 정상 등

---

## 도메인별 건강도 점수 (100점 만점)

| 도메인 | 점수 | 한줄 평가 |
|--------|:---:|-----------|
| 보안 (XSS/injection/secret) | **92** | XSS 프리미티브·비밀관리 모범. center 내부 teacher 격리만 갭(MEDIUM) |
| DB 스키마 정합성 | **90** | 위반 0. 죽은 컬럼 1건(child_id)·기능 갭만 관찰 |
| 코딩 컨벤션 | **98** | 금지 문법·console.log·중복정의 전부 0건. 거의 완벽 |
| RBAC (역할·권한) | **88** | 서버 강제가 진짜 경계로 일관. viewOtherChildren·클라가드 불일치만 보완 |
| 에러 핸들링 | **82** | 성숙도 높으나 삭제/저장 낙관적 처리 1 HIGH + fire-and-forget 잔존 |
| 성능·중복 | **90** | 캐시·페이지네이션·룩업테이블 견고. 반복일정 배치화만 필요 |
| UI/UX | **78** | 기능 분기 양호하나 다크모드 인라인색·터치타겟·FOUC 다수 |
| Edge Functions | **91** | CORS/JWT/rate limit/입력검증 모범. cross-tenant settings·secret 폴백만 정리 |
| PWA/SW/Push | **84** | 캐시 갱신·정리 정상. offline.html·IDB hang·푸시 재시도 보강 여지 |
| **종합** | **88** | **성숙한 코드베이스. HIGH 2건 처리 후 90점대 진입** |

---

## 권고 수정 순서 (로드맵)

**1순위 — 즉시(1줄~소규모, 위험 대비 비용 최소)**
1. `index.html:1254` 배포버튼에 `display:none;` 추가 (H-2, FOUC 차단)
2. `madi-app.js:467` `<\span>` → `</span>` 오타 수정 (M-2, undo 토스트 깨짐)
3. `madi-ai.js:588-614` deleteIEPRecord를 deleteAssessment 패턴(서버 DELETE 게이트)으로 재구성 + 593줄 saveIEP() 제거 (H-1, 유령 부활 차단)

**2순위 — 이번/다음 스프린트(저장 정합성·UX)**
4. `madi-schedule.js:757` 반복일정 배치 POST 분기 + `madi-chat.js:306`·`madi-children.js:103`·`madi-schedule.js:1005` 성공 토스트 `.then(ok)` 게이트 (M-6, M-7)
5. 학부모 포털 다크모드 인라인색 클래스화/CSS변수 — `madi-parent-pages.js:799,137`·`madi-parent-home.js:796` (M-3, M-4)
6. 헤더 액션 버튼 min-height 44px 상향 (M-5)
7. PWA 보강: `madi-deploy.js:35` tx.onerror 추가, sw.js offline.html lazy-prime (M-10)

**3순위 — 스키마/정책 변경 동반(설계 선행 필요)**
8. `madi_children`에 assigned_teacher_id 컬럼 신설 → api/index.ts teacher 스코프에 서버 강제 필터 (M-1, 다자녀·이관 시나리오 설계 선행). 변경 전까지 PERM_LIST에 'UI 편의(서버 강제 아님)' 명기
9. `madi_settings` cross-tenant 격리 정책 확정 후 center_id 컬럼/key prefix (M-8)
10. upload-image JWT_SECRET 폴백 제거 → MADI_JWT_SECRET 단일화 (M-9)

> **라이브 프로브 보완 권고**: 이번 점검은 정적 감사만 완료됐습니다. 실 DB 무결성·SCHEMA.md↔실DB 불일치·Edge 계약은 `MADI_PROBE_USER`/`MADI_PROBE_PW` 환경변수 설정 후 `node tests/live-probe.js` 재실행으로 검증하시길 권합니다(특히 child_id 죽은 컬럼·madi_settings 격리는 실DB 확인 시 결론이 더 명확해집니다).

---

## 잘 구현된 부분 (Keep)

1. **서버 프록시(/api)가 RBAC의 진짜 경계** — JWT 검증(alg:none/exp 강제) + 테이블별 화이트리스트 + center_id 강제주입 + parent default-deny + 권한상승 PATCH 방어 + 민감컬럼 select 차단. 클라이언트 분기 65곳이 전부 이 서버 정책의 미러로 동작.
2. **XSS 방어 프리미티브 + ESLint 강제** — escHtml(5문자) · jsArg=escHtml(escJs(x)) 이중맥락 차단 · isSafeUrl javascript: 차단. pre-commit no-unsanitized로 신규 위반 유입까지 봉쇄. eval/new Function 운영코드 0건.
3. **비밀 관리·프록시 아키텍처** — anon key/JWT secret/Anthropic 키 하드코딩 0건. service_role은 서버 Deno.env 전용, admin도 API 키 값을 못 봄(2026-06-13 평문 폴백 제거).
4. **에러 핸들링 표준의 성숙도** — showError가 상태코드·테이블명 마스킹, 모든 JSON.parse가 try-catch/safeJsonParse 경유, 로딩 스피너 catch 일관 복구. saveSession/deleteAssessment가 '서버 게이트' 표준 레퍼런스로 정착.
5. **성능 패턴** — supaFetch 5분 TTL 자동캐시 + 쓰기 시 테이블 자동 무효화, djb2 해시 기반 렌더스킵(open 카드 보존), CHILD_PAGE_SIZE 페이지네이션, 룩업테이블(myChildIds Set/cgSessByChild)로 N+1·풀스캔 제거.

---

## 추가 개선 제안

- **삭제/저장 '서버 게이트' 패턴의 린트 룰화**: H-1(IEP)·M-7(schedule) 모두 동일 안티패턴(낙관적 UI + 무롤백/무게이트)의 재발입니다. deleteAssessment가 이미 회귀로 고쳐졌는데 형제 경로에서 재발한 만큼, '`saveXXX(...).then` 없이 직후 성공 토스트' 패턴을 잡는 커스텀 ESLint 룰 또는 smoke 박제를 추가하면 세 번째 재발을 구조적으로 차단할 수 있습니다.
- **`madi_schedules.child_id` 결정**: 죽은 컬럼을 채울지(미래 join 대비) SCHEMA.md에 'present-but-unpopulated' 주석을 박을지 한 번에 결정해두면 추후 이 컬럼을 신뢰하는 코드의 silent zero-row 사고를 예방합니다.
