# 마디 인계 노트 — 대시보드 페르소나 분기 작업 완료 (2026-05-21)

> 이전 인계 [`HANDOFF_DASHBOARD_REDESIGN_2026-05-21.md`](HANDOFF_DASHBOARD_REDESIGN_2026-05-21.md) 의 후속 — 작업 완료 보고.

## 0. 결과 요약

| Step | 내용 | 상태 |
|------|------|------|
| 0 | 사전 점검 (학부모 진입점, 라운지·정산 모델) | ✅ 완료 |
| 1 | 공통 인프라 (라우터 + DOM 컨테이너 + CSS 토큰) | ✅ 완료 |
| 2 | Teacher 홈 ⑥ — `renderDashboardTeacher()` | ✅ 완료 |
| 3 | Parent 홈 ⑦ — `parentPanelHome` + `loadParentHome()` 확장 | ✅ 완료 |
| 4 | Admin/Super 홈 ⑧ — `renderDashboardAdmin()` (super 재활용) | ✅ 완료 |
| 5 | smoke 검증 + 배포 | ✅ 완료 |

**커밋**: `88906d5..627c634` (11개 커밋)
- `3963a46` Teacher + Admin 페르소나
- `e04e872` Parent 페르소나
- `9de1be6` Superadmin 라벨 폴리시
- `31aa058` 선생님 활동표 madi_users 확장 + 안전 가드
- `f2b0d2c` 학부모 panelHome FOUC 가드
- `33e4330` Parent 발달 그래프 평가 점수 반영
- `c633e49` Teacher 이번 주 작성률 — 미래 일정 분모 제외
- `3b2f043` Admin 진도율 — 미래 일정 분모 제외
- `d06d08a` Admin 매출 추정 산식 인라인 expand
- `00a5d72` Admin 하단 패널 (운영 알림 + 빠른 액션)
- `6bf50fb` 데이터 갱신 시각 표시
- `627c634` 공지 내용 XSS escape

**smoke**: 23 / 0 통과 (변동 없음)
**배포**: GitHub Pages 1~2분 후 자동 반영 — 사용자에게 강제 새로고침 (Ctrl+Shift+R) 안내 필요

---

## 1. 변경 파일 (3개)

| 파일 | 변경량 | 핵심 추가 |
|------|--------|----------|
| `index.html` | +93 / -50 | `panelHome` 페르소나 컨테이너 3개 + `parentPanelHome` 재구성 |
| `madi-03.js` | +733 | `renderDashboard()` 라우터 + Teacher/Admin 렌더러 + 헬퍼 |
| `madi-15.js` | +280 / -56 | `loadParentHome()` 확장 + 자녀 히어로/그래프/바우처 렌더러 |
| `madi.css` | +312 | `.dp-*` (공통 페르소나) + `.dp-p-*` (학부모 핑크) 토큰 |

---

## 2. 페르소나 진입점 (확정)

```
                     ┌─ teacher    → renderDashboardTeacher()  (panelHome 내 dashTeacher)
showDashboard() ─→ ──┤
renderDashboard()    ├─ admin      → renderDashboardAdmin()    (panelHome 내 dashAdmin)
                     ├─ superadmin → renderDashboardAdmin()    (전체 센터 집계 라벨)
                     └─ fallback   → renderDashboardLegacy()   (panelHome 내 dashLegacy)

applyParentUI() ─→ switchParentTab('home') ─→ loadParentHome()  (parentPanelHome 전용)
```

학부모는 `panelHome` 을 사용하지 않으므로 `renderDashboard()` 라우터 외부.
**중요**: 라우터 분기 추가는 teacher/admin/superadmin 만 다루면 됨.

---

## 3. 데이터 결정 사항

### 매출 (Admin)
**Option ⓒ 채택** — `madi_settlements` / `madi_payments` 테이블 미구현이라 추정값으로 표시.

```js
// madi-03.js 안 _DP_VOUCHER_PRICE
'발달재활바우처':         33000원/회
'우리아이심리지원서비스바우처': 40000원/회
'꿈E든카드바우처':         30000원/회
'나래사랑카드바우처':       35000원/회
'일반' / null:           40000원/회
```

**계산**: 이번 달 완료 세션 × 해당 아동 바우처 단가 합산.
**UI 표기**: "이번 달 매출 (추정)" + 노란 태그 "📌 바우처 단가 × 완료 세션 추정값" 으로 추정값임을 분명히 표시.

→ 차후 정산 테이블 도입 시 `_DP_VOUCHER_PRICE` 와 그 호출 부분만 교체하면 됨.

### 답변 대기 메시지 (Teacher / Parent)
`madi_lounge_posts` 의 `visibility = 'private_admin'` 글 중 본인이 author 가 아닌 글 = 받은 메시지.
- author_id 비교 우선 (`p.author_id !== currentUser.id`)
- author_id 없으면 author_name 으로 fallback

### 가정 활동 (Parent)
정적 가이드 3개 (체크박스 토글). `madi_home_activities` 테이블 미구현이라 placeholder.
→ 차후 테이블 만들면 `_renderParentHomeActivities()` 만 교체.

### 바우처 사용 회차 (Parent)
`madi_sessions?child_id=eq.X` 결과 길이로 계산 후 `window._parentVoucherUsed` 캐싱.
자녀 전환 시 (`setActiveParentChild`) 캐시 무효화.

---

## 4. CSS 네임스페이스

| 클래스 | 용도 |
|--------|------|
| `.dp-*` | 공통 페르소나 (Teacher, Admin) |
| `.dp-p-*` | 학부모 전용 (핑크 톤) |
| `.dp-av-1` ~ `.dp-av-6` | 결정론적 아바타 색상 (이름 해시) |
| `.dp-kic-blue/green/purple/rose/amber` | KPI 아이콘 배경 |

`madi.css` 끝부분 약 312줄 추가.

---

## 5. 알려진 한계·차후 개선 후보

### 발달 그래프 (Parent) — ✅ 개선 완료 (`33e4330`)
`madi_assessments.scores` 평균을 월별 집계해서 100점 만점 그래프로 표시.
평가 0건이면 자동으로 세션 카운트 그래프 fallback.

### 선생님 활동 표 (Admin) — ✅ 개선 완료 (`31aa058`)
`madi_users` 직접 조회로 활동 0건 선생님까지 표시 (회색 처리).
admin → 본인 센터 / superadmin → 전 센터 분기.

### 이번 주 작성률 / 진도율 정확도 — ✅ 개선 완료 (`c633e49`, `3b2f043`)
미래 일정이 분모에 포함되어 항상 낮게 보이던 버그 수정.
도래분만 분모로 사용 + 남은 일정 정보는 별도 표기.

### Admin 매출 산식 투명성 — ✅ 개선 완료 (`d06d08a`)
히어로의 "📌 바우처 단가 × 완료 세션 추정값" 클릭 시 단가표 펼침.
바우처 종류별 세션 수 / 단가 / 소계 / 합계 + 단가 수정 경로 안내.

### Admin 하단 패널 (운영 알림 + 빠른 액션) — ✅ 개선 완료 (`00a5d72`)
미리보기 ⑧ 의 grid-2-bottom 누락 보완.
정산 대기·미작성·공지 알림 + 정산처리·라운지·선생님관리·리포트 액션.

### 데이터 갱신 시각 표시 — ✅ 개선 완료 (`6bf50fb`)
헤더 greeting 줄에 "데이터 갱신: 방금 전 / N분 전" 회색 메타.
실시간 폴링(10초) 이 loadDBFromSupabase 를 호출할 때마다 갱신.

### Super 센터 셀렉터
현재 superadmin = admin 재활용 + "전체 센터 집계" 라벨만 추가.
사이드바에 센터 드롭다운 추가는 별도 작업 — 결정되면 `dashAdmin` 헤더에 셀렉터 마운트.
**주의**: loadDBFromSupabase 의 safeMap 이 center_id 를 carry over 하지 않으므로
구현 시 select 에 center_id 추가 + safeMap 수정 + saveChildren 영향 확인 필요.

### 매출 단가 사용자 편집
현재 `_DP_VOUCHER_PRICE` 가 madi-03.js 안에 하드코딩.
센터별 단가 설정 UI 가 필요해지면 `madi_settings` 테이블에 저장 후 로드.

### 가정 활동 테이블
`_renderParentHomeActivities()` 가 정적 3개 placeholder.
`madi_home_activities` 테이블 도입 시 그 함수만 교체.

### Edge Function 미수정
이번 작업은 클라이언트 전용. `supabase/functions/api/index.ts` 등 백엔드 변경 없음.
→ 배포 명령 (`supabase functions deploy api`) 불필요.

---

## 6. 검증·테스트 시나리오

새 세션에서 다음 순서로 검증 권장:

```powershell
git pull
node tests/smoke.js            # 23 / 0 확인
# 강제 새로고침 (Ctrl+Shift+R)
```

### 역할별 로그인 테스트
1. **teacher 계정**: 미작성 배너 + KPI 4 + 오늘 타임라인 표시 확인
   - 미작성 없을 때 배너 미표시
   - 답변 대기 메시지가 라운지 데이터로 채워지는지
2. **admin 계정 (`dinosau` 외)**: 매출 히어로 + 추이 그래프 표시
   - "추정값" 라벨 보이는지
   - 선생님 활동 표 0건 안내 동작
3. **superadmin (`dinosau`)**: "전체 센터 집계" 보조 라벨 확인
4. **parent 계정**: 자녀 히어로 카드 + 그래프 + 바우처 진행률
   - 자녀 미연결 학부모 → 온보딩 카드만 표시 (페르소나 패널 숨김)
   - 다자녀 → 셀렉터에서 전환 시 데이터 재로드

### 빈 상태
- `childDB.length === 0` → KPI 0, 그래프 빈 영역
- `sessionDB.length === 0` → 매출 ₩0, 진도율 0%
- `scheduleDB.length === 0` → 오늘 일정 없음, "오늘 예정된 세션이 없습니다"

---

## 7. 자주 쓰는 명령

```powershell
# 변경 확인
git log --oneline -5
git status

# 테스트
node tests/smoke.js

# 검증된 식별자
# - GitHub: https://github.com/namga1541-prog/MADI
# - Supabase project ref: ujxdhafzjyrglaclarwe
# - 운영 URL: https://namga1541-prog.github.io/MADI/
```

---

## 8. 사용자 안내 메시지 템플릿

> 대시보드 페르소나 분기 작업 완료했습니다.
>
> - 선생님 로그인 → ⑥ 디자인 (미작성 배너 / KPI 4 / 오늘 타임라인 / 담당 아동)
> - 학부모 로그인 → ⑦ 디자인 (자녀 히어로 / 발달 그래프 / 바우처 / 가정 활동)
> - 센터장 로그인 → ⑧ 디자인 (매출 추정 / 운영 KPI / 선생님 활동표 / 추이 그래프)
> - 슈퍼관리자 → ⑧ 동일 + "전체 센터 집계" 라벨
>
> **Ctrl + Shift + R 로 강제 새로고침** 해주세요.
>
> 매출은 바우처 단가 × 완료 세션의 **추정값** 입니다. 정산 테이블이 생기면 실제값으로 교체합니다.

---

## 9. CLAUDE.md 규칙 준수 확인

- ✅ 바닐라 JS (ES5 호환 — var, function, Array.fill 미사용)
- ✅ DB 접근 supaFetch() 경유
- ✅ 사용자 입력 escHtml() 처리
- ✅ HTML ID camelCase
- ✅ 자동 커밋·푸시 완료 (3개 커밋, main push)
- ✅ console.log 운영 코드 추가 없음
- ✅ Edge Function 변경 없음 (배포 불필요)
