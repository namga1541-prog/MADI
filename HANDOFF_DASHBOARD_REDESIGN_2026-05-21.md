# 마디 인계 노트 — 대시보드 페르소나별 분기 반영 (Option A)

> **새 Claude Code 세션 시작 시 이 문서를 그대로 첨부해 주세요.**
> 작업 작성일 2026-05-21 · 이전 인계 [`HANDOFF_2026-05-21.md`](HANDOFF_2026-05-21.md) 참고

---

## 0. 빠른 재개

```powershell
cd C:\Users\2021091\Desktop\madi-app    # 또는 다른 PC clone 경로
git pull
node tests/smoke.js                      # 통과 확인 (23 / 0)
```

**마지막 커밋**: `0ab4ec1` — ⑧ Admin Home (Phase 3) 미리보기 추가

---

## 1. 이번 작업 목표

대시보드 홈 화면이 모바일 앱 느낌이고 모든 역할에게 같은 운영 KPI(등록/대기/종결/누적)를 보여주는 문제 해결.

**`madi-03.js` 의 `showDashboard()` / `renderDashboard()`** 를 `currentUser.role` 기준 4갈래로 분기해서, 페르소나별로 완전히 다른 카드 구성과 우선순위를 가지게 한다.

```
                   ┌─ teacher    → 미작성 배너 + 오늘 타임라인 + 답변 대기 + 내 담당
showDashboard() ──┼─ parent     → 자녀 카드 + 발달 그래프 + 가정 활동 + 다음 일정
                   ├─ admin      → 매출 히어로 + 선생님 활동표 + 변동 아동 + 계획 vs 실제
                   └─ superadmin → admin 베이스 + 센터 셀렉터 또는 전체 센터 집계
```

**예상 작업 시간**: 8~12시간 (단계적, 한 페르소나당 2~3시간)

---

## 2. 페르소나별 미리보기 (이 디자인을 그대로 이식)

| Phase | 페르소나 | 미리보기 파일 | 핵심 컴포넌트 |
|-------|---------|---------------|---------------|
| 1 | 👩‍⚕️ Teacher | [`design-previews/06-teacher-home.html`](design-previews/06-teacher-home.html) | 미작성 배너 / KPI 4 / 오늘 타임라인 / 답변 대기 / 담당 아동 카드 / 이번 주 요약 / 빠른 액션 |
| 2 | 👨‍👩‍👧 Parent | [`design-previews/07-parent-home.html`](design-previews/07-parent-home.html) | 자녀 큰 카드 / 이번 주 세션 / 선생님 메시지 / 발달 추이 그래프 / 가정 활동 체크 / 바우처 |
| 3 | 🎯 Admin | [`design-previews/08-admin-home.html`](design-previews/08-admin-home.html) | 매출·정산 히어로 / 운영 KPI / 선생님 활동표 / 변동 아동 / 계획 vs 실제 그래프 |
| 4 | 👑 Super | (⑧ 재활용 + 센터 셀렉터) | ⑧ admin 동일 + 사이드바 센터 선택 드롭다운 (지금은 전체 센터 데이터 흐름 그대로) |

비교 인덱스: [`design-previews/index.html`](design-previews/index.html) — 4가지 컨셉(①Linear / ②Stripe / ③Notion / ④Clinical / ⑤Hybrid) + 페르소나 3종 모두 비교 가능.

운영 URL: `https://namga1541-prog.github.io/MADI/design-previews/06-teacher-home.html` 등.

---

## 3. 현재 코드 상태

### 진입점

```js
// madi-01.js:138
function hideLoginScreen(){
  document.getElementById('loginScreen').style.display = 'none';
  showDashboard();  // ← 여기로 들어옴
}

// madi-03.js:279
function showDashboard() {
  // 패널 active 제어 + 사이드바 동기화 후
  renderDashboard();   // ← 실제 카드 렌더
}

// madi-03.js:302
function renderDashboard() {
  // 현재: 단일 디자인 4개 패널에 채움
  // 변경 후: role 분기
}
```

### 현재 단일 디자인 4 패널 (index.html 의 panelHome 안)

```
dashTodaySched   — 오늘 일정
dashChildStat    — 아동 현황 (등록/대기/종결/전체)
dashUnwritten    — 미작성 세션
dashNotices      — 공지
```

`renderDashboard()` 가 위 4 개 컨테이너에 innerHTML 으로 카드 그림.

### 데이터 출처 (전역 변수)

| 변수 | 내용 | 소스 |
|------|------|------|
| `childDB` | 아동 목록 | `madi_children` |
| `sessionDB` | 세션 기록 | `madi_sessions` |
| `scheduleDB` | 일정 | `madi_schedules` |
| `assessmentDB` | 평가 | `madi_assessments` |
| `_bannerNotices` | 공지 (전사+센터) | `madi_global_notices` + `madi_notices` |
| `currentUser` | 로그인 사용자 | login Edge Function 응답 |

### 헬퍼 함수

```js
getUnwrittenSessions()    // 미작성 세션 배열 반환
fmtDateKR(yyyy-mm-dd)     // '2026년 5월 21일'
nowKST() / ymd()          // KST 날짜 유틸 (madi-01.js)
escHtml()                 // XSS 방어
supaFetch(path, method, body)  // 모든 DB 접근
```

---

## 4. 페르소나별 데이터 매핑

### Phase 1 · Teacher 홈 (⑥)

| 미리보기 컴포넌트 | 데이터 소스 | 비고 |
|------|-------|------|
| 미작성 세션 배너 | `getUnwrittenSessions().filter(u => u.teacher === currentUser.name)` | 이미 패턴 있음 |
| KPI: 내 담당 아동 | `Array.from(new Set([...sessionDB,...scheduleDB].filter(x=>x.teacher===currentUser.name).map(x=>x.childId))).length` | unique childId 수 |
| KPI: 오늘 세션 | `scheduleDB.filter(s=>s.date===todayStr && s.teacher===currentUser.name).length` | |
| KPI: 이번 주 작성률 | 이번 주 schedule 중 session 매칭된 비율 | 계산 필요 |
| KPI: 답변 대기 | 라운지 글 중 본인 응답 대기 | `madi_lounge_posts` 조회 (data 모델 확인 필요) |
| 오늘 타임라인 | `scheduleDB.filter(today + teacher)` 정렬 | 미리보기 카드 구조 그대로 |
| 답변 대기 메시지 | `madi_lounge_posts` 중 본인 수신 + 답변 없는 것 | 라운지 1:1 메시지 미구현이면 보류 |
| 내 담당 아동 4명 | 최근 만난 순으로 4명 | sessionDB 정렬 후 distinct childId 4개 |

### Phase 2 · Parent 홈 (⑦)

학부모 진입점은 `madi-09.js` / `madi-15.js` 일 가능성 — **먼저 확인**:
```bash
grep -n "showDashboard\|panelHome" madi-09.js madi-15.js index.html
```

학부모 로그인 흐름이 `doLogin()` 을 공유하면 `currentUser.role === 'parent'` 분기에서 새 홈 렌더.
별도 진입점이면 `madi-09.js` 의 entry 함수 수정.

| 미리보기 컴포넌트 | 데이터 소스 |
|------|-------|
| 자녀 목록 | `supaFetch('madi_parent_children?parent_user_id=eq.' + currentUser.id, 'GET')` |
| 자녀 정보 | `childDB.filter(c => parentChildIds.includes(c.id))` |
| 이번 주 세션 | `sessionDB.filter(s => parentChildIds.includes(s.childId) && this_week)` |
| 선생님 메시지 | 라운지 1:1 학부모 수신 (`visibility === 'private_admin'`?) 확인 필요 |
| 발달 추이 그래프 | `assessmentDB.filter(a => parentChildIds.includes(a.childId))` → 월별 점수 |
| 가정 활동 체크리스트 | **새 테이블 필요할 수 있음** — `madi_home_activities` 또는 세션 기록의 메모 |
| 바우처 진행률 | `madi_children.voucher_total / voucher_used` (스키마 확인) |

### Phase 3 · Admin 홈 (⑧)

| 미리보기 컴포넌트 | 데이터 소스 |
|------|-------|
| 매출 히어로 | **새 테이블 필요** — `madi_settlements` 또는 `madi_payments` 미구현이면 일정+바우처 단가 계산 |
| 정산 대기 N건 | 위와 동일 |
| KPI 활동 중인 아동 | `childDB.filter(c => c.status === '등록').length` |
| KPI 대기 | `c.status === '대기'` |
| KPI 종결 (이번 달) | `c.status === '종결' && updated_at this month` |
| KPI 전체 누적 | `childDB.length` |
| 선생님 활동 표 | `madi_users.filter(u => u.center_id === currentUser.center_id && u.role === 'teacher')` 각자 sessionDB 집계 |
| 이번 주 아동 변동 | `childDB.filter(c => updated_at this week)` 상태별 분류 |
| 세션 추이 그래프 (계획 vs 실제) | `scheduleDB` 일별 카운트 (계획) + `sessionDB` 일별 카운트 (실제) |

**미구현 데이터 (매출, 가정 활동) 처리 방침**:
- Option ⓐ — 일단 빈 상태 / "준비 중" 표시
- Option ⓑ — 새 테이블·컬럼 미리 추가하고 일부 더미 데이터
- Option ⓒ — 일정+바우처 단가 곱셈으로 매출 추정값 계산

→ **다음 세션 시작 시 사용자에게 한 번 확인 후 진행**.

---

## 5. 단계별 작업 계획

### Step 0 — 사전 점검 (15분)
- 학부모 진입점 확인: `grep -rn "role === 'parent'" madi-*.js index.html`
- 라운지 1:1 메시지 데이터 모델 확인: `madi-14.js` 의 `madi_lounge_posts` 사용 패턴
- 정산·매출 관련 테이블 존재 여부: `supabase db query --linked "select table_name from information_schema.tables where table_name like 'madi_%';"`

### Step 1 — 공통 인프라 (1~2시간)
1. `madi-03.js:302 renderDashboard()` 를 라우터로 변경:
   ```js
   function renderDashboard() {
     var role = currentUser && currentUser.role;
     if (role === 'teacher') return renderDashboardTeacher();
     if (role === 'parent')  return renderDashboardParent();
     if (role === 'admin')   return renderDashboardAdmin();
     if (role === 'superadmin') return renderDashboardAdmin();  // 일단 admin 재활용
     return renderDashboardLegacy();  // fallback (현재 코드 보존)
   }
   ```
2. `index.html` 의 `#panelHome` 안에 페르소나별 컨테이너 3개 추가:
   ```html
   <div id="panelHome">
     <div id="dashTeacher" style="display:none;"></div>
     <div id="dashParent"  style="display:none;"></div>
     <div id="dashAdmin"   style="display:none;"></div>
     <!-- 기존 카드들은 legacy 컨테이너로 -->
     <div id="dashLegacy">  ... 기존 dashTodaySched 등 ... </div>
   </div>
   ```
3. `madi.css` 에 페르소나별 prefix 클래스 토큰 추가 (`.dash-t-*`, `.dash-p-*`, `.dash-a-*`).

### Step 2 — Phase 1: Teacher 홈 (2~3시간)
1. `design-previews/06-teacher-home.html` 의 `.content` 내부 HTML 을 `renderDashboardTeacher()` 가 생성하는 문자열로 변환.
2. CSS 를 `madi.css` 에 이식 (클래스명 충돌 피해서 `.dash-t-*` 또는 그대로).
3. 가상 데이터(김선생, 김민서…)를 실제 데이터로 치환:
   - `childDB`, `sessionDB`, `scheduleDB` 필터링
   - 빈 상태 / 일부 데이터만 있는 케이스 모두 대응
4. 클릭 핸들러 연결 (타임라인 카드 → `switchTab(...)` 이동 등)
5. 자동 커밋·푸시 → 실제 teacher 계정으로 테스트

### Step 3 — Phase 2: Parent 홈 (2~3시간)
1. **학부모 진입점 확인 후** Phase 1 패턴 그대로 적용.
2. `madi_parent_children` 조회 → 자녀 ID 배열 확보.
3. 자녀 1명일 때 / 다자녀일 때 분기 (다자녀는 자녀 스위처).
4. 발달 추이 그래프 — SVG inline 으로 동적 생성 (미리보기 그대로 가져다 데이터만 치환).
5. 가정 활동 / 바우처 — 데이터 없으면 빈 상태 또는 "준비 중" 표시.

### Step 4 — Phase 3: Admin / Super 홈 (3~4시간)
1. 매출 데이터 처리 방침 사용자 확정 후 적용.
2. 선생님 활동표 — `madi_users` 조회 후 각자 sessionDB 집계 (N+1 주의, 한 번에 가져와서 클라이언트 계산).
3. 세션 추이 그래프 — 일별 카운트 SVG 동적 생성.
4. Super 는 admin 재활용하되 사이드바에 센터 선택 드롭다운 추가 (선택사항, Phase 3 끝나고 따로).

### Step 5 — 정리·배포 (1시간)
- smoke 테스트 통과 확인
- 각 role 별 로그인 테스트 (teacher / admin / superadmin / parent)
- 빈 상태·다양한 데이터 시나리오 손으로 확인
- 커밋·푸시 (CLAUDE.md 자동 커밋 규칙)
- `legacy` fallback 제거 또는 유지 결정
- sw.js 캐시 버전 자동 갱신되는지 확인
- 사용자 안내: 강제 새로고침 (Ctrl+Shift+R) 필요

---

## 6. 트레이드오프·주의사항

### ⚠️ 학부모 비밀번호 정책
- **현재 4자 이상 테스트 모드 유지 중** ([`memory/password_policy_test_mode.md`](.claude/projects/.../memory/password_policy_test_mode.md))
- 이번 작업과 무관 — 건드리지 말 것

### ⚠️ untracked 파일들
- `.claude/`, `supabase/.temp/`, `madi_upload_script.txt.js` 등은 **의도적 미커밋**
- `git add -A` 금지. 변경한 파일만 명시적으로 `git add`

### ⚠️ Edge Function 배포
- 만약 `api` Edge Function 의 PATCH 응답 처리 등 수정 필요 시:
  ```
  supabase functions deploy api --project-ref ujxdhafzjyrglaclarwe --no-verify-jwt
  ```
- `--no-verify-jwt` 필수 (없으면 401 차단)

### ⚠️ 데이터 빈 상태 처리
- 미리보기는 가상 데이터로 모든 카드가 채워져 있음
- 실제는 신규 가입 직후 / 자녀 0명 / 미작성 0건 등 다양 — **빈 상태 카드 모두 만들어야 함**
- 미리보기의 `tl-empty-*`, `empty-clean-*` 패턴 활용

### ⚠️ 학부모 진입점이 다르면
- `madi-09.js` 또는 별도 페이지에서 `renderParentHome()` 직접 호출하도록 분기 추가
- `showDashboard()` 단일 분기로 안 끝날 수 있음

### ⚠️ Super 페르소나 ⑨ 미리보기
- 옵션 D 였던 `09-super-home.html` 은 아직 안 만들어짐
- 일단 admin 재활용으로 진행하고, 차이가 명확해지면 별도 만들기

---

## 7. CLAUDE.md 핵심 규칙 재상기

- **바닐라 JS (ES5 호환)** — `var`, `function`, `.then()`. arrow function·class 금지
- **DB 접근은 supaFetch() 경유** — 직접 anon key 사용 금지
- **사용자 입력 escHtml()** 처리 필수
- **HTML ID camelCase** — `dashTeacherKpi`, `dashParentChart` 등
- **모든 코드 수정 후 자동 커밋·푸시** — 사용자가 "커밋하지 마" 라고 하지 않는 한
- **console.log 운영 코드 추가 금지**
- **Edge Function 배포 시 `--no-verify-jwt` 필수**

---

## 8. 새 세션 시작 첫 메시지 템플릿

```
마디 앱 대시보드 페르소나 분기 작업 이어갑니다.
인계 문서 HANDOFF_DASHBOARD_REDESIGN_2026-05-21.md 참고.

오늘 진행할 단계:
[ ] Step 0 사전 점검 (학부모 진입점, 정산 테이블 확인)
[ ] Step 1 공통 인프라 (renderDashboard 라우터 + 컨테이너)
[ ] Step 2 Phase 1 Teacher 홈 실제 반영
[ ] Step 3 Phase 2 Parent 홈
[ ] Step 4 Phase 3 Admin 홈
[ ] Step 5 정리·배포

먼저 Step 0 점검부터 시작해줘.
```

---

## 9. 빠른 참조

### 자주 쓰는 명령

```powershell
# 코드 받기·올리기
git pull
git status                          # untracked 의도적 미커밋 확인
git add madi-03.js madi.css index.html  # 변경 파일 명시적 add
git commit -F .git/COMMIT_MSG_TEMP  # 한글 메시지는 -F 로
git push origin main

# 테스트
node tests/smoke.js                  # 23 / 0 통과 확인

# DB 임시 쿼리
supabase db query --linked "SELECT ..."

# Edge Function 배포
supabase functions deploy <name> --project-ref ujxdhafzjyrglaclarwe --no-verify-jwt
```

### 식별자

- GitHub: `https://github.com/namga1541-prog/MADI`
- Supabase project ref: `ujxdhafzjyrglaclarwe`
- 운영 URL: `https://namga1541-prog.github.io/MADI/`

### 핵심 파일

| 파일 | 역할 |
|------|------|
| `madi-03.js:279` | `showDashboard()` 진입 |
| `madi-03.js:302` | `renderDashboard()` — **이번 작업 대상** |
| `madi-03.js:316~350` | 현재 4 패널 채우는 로직 (legacy 보존 참고) |
| `index.html` 의 `panelHome` | DOM 컨테이너 추가 위치 |
| `madi.css` | 페르소나별 CSS 토큰 추가 위치 |
| `design-previews/06,07,08-*.html` | 이식 원본 (HTML + CSS 모두 인라인) |

### 페르소나 결정 사항 (사용자 확정)
- 선생님 홈: 미리보기 ⑥ 그대로
- 학부모 홈: 미리보기 ⑦ 그대로
- 센터장 홈: 미리보기 ⑧ 그대로
- 슈퍼관리자: ⑧ admin 재활용으로 시작

---

작업 분량이 큽니다. 사용자가 중간에 진행 상황을 보고 싶을 수 있으니 **각 Phase 끝날 때마다 커밋·푸시·강제 새로고침 안내** 하세요.
