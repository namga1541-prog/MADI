# 모바일(Android·iOS) UI/UX 전수점검 (2026-06-29)

6개 영역 병렬 정적 감사(iOS Safari·터치타깃·스크롤/오버레이·반응형/세이프에리어·폼/키보드/PWA·빠른기록/학부모) + 375px 라이브 뷰포트 실측.

> **기반 양호**: viewport-fit=cover, 헤더·FAB·토스트 safe-area, dvh 폴백 다수, touch-action:manipulation, 버튼 min-height:44px(다수), 모달 overscroll-behavior:contain(일부), PWA manifest/아이콘/외부링크 전부 정상. **아래는 이 보호장치가 빠진 구멍.**

## 정정/오탐 (먼저)
- **`.login-input` 줌**: CSS상 14.5px이나 모바일 실측 16px(오버라이드 존재) → iOS 줌 **비해당**. 가입 입력칸도 전부 48px/16px ✓.
- **`-webkit-overflow-scrolling:touch` 누락 다수**: 현대 iOS(13+)는 기본 관성 스크롤 → 사실상 **무해**(레거시 속성). 우선순위 제외.
- **가로 오버플로**: 랜딩 375px 실측 0건 ✓.

---

## Tier 1 — 베타 막는 실사용 결함 (즉시)

### T1-1. 아이디 입력 자동 대문자·자동수정 → 로그인/가입 실패 (iOS 치명)
로그인·가입·관리자 직원추가의 아이디 input에 `autocapitalize`/`autocorrect` 미설정. iOS Safari가 첫 글자를 대문자화·자동수정 → 가입한 아이디와 로그인 아이디가 달라져 **로그인 불가**.
- index.html:931(로그인), index.html:1052(가입), admin.html:528/583(직원·학부모 생성)
- **수정**: 아이디 input에 `autocapitalize="none" autocorrect="off" autocomplete="username"`, 비번에 `autocomplete="current-password"/"new-password"`. (라이브 실측으로 확인)

### T1-2. 하단 탭바·바텀시트 모달 safe-area-inset-bottom 누락 → 홈인디케이터에 가림
iPhone 전기종에서 마지막 탭/모달 하단 버튼이 홈 인디케이터에 겹침.
- `.tabs`(madi.css:363) padding-bottom 누락
- `.sched-modal`(:271) padding-bottom:32px 고정, `.pwa-modal`(:1115) 40px 고정, `.bulk-action-bar`(:537)
- **수정**: `padding-bottom: calc(<기존> + env(safe-area-inset-bottom, 0px))`

### T1-3. 학부모 홈 SVG 차트 고정폭(600) → 320~360px에서 잘림
학부모 주요 화면의 차트가 좁은 단말에서 x축 레이블·데이터가 어긋나고 잘림.
- madi-parent-home.js:488,565 (`viewBox 0 0 600`)
- **수정**: 컨테이너 clientWidth로 동적 폭 계산

### T1-4. 모달 열림 시 body 스크롤 락 없음 → 배경 같이 스크롤(Android)
모달 open 시 `body{overflow:hidden}` 설정 코드 부재. 모바일 `.app-main`이 body 스크롤에 의존해 증상 큼. + 오버레이 overscroll-behavior 누락으로 스크롤 전파.
- 전 모달(madi-schedule/board/auth/parent), `.sched-modal-overlay`(:270), `.chat-messages`(:960)
- **수정**: open/close 시 body overflow 토글 + 오버레이에 `overscroll-behavior:contain`

---

## Tier 2 — 명확한 불편 (베타 중 빠르게)

### T2-1. 숫자 입력 풀키보드 (inputmode 누락)
점수·치료시간(분)·바우처한도·2FA 6자리가 `type="number"`/text인데 `inputmode` 없음 → 숫자에 풀 키보드.
- madi-child-detail.js:168,291 / madi-schedule.js:634,795 / madi-growth.js:341 / admin.html:736 / madi-auth.js:227(2FA)
- **수정**: `inputmode="numeric"`(정수) / `"decimal"`

### T2-2. 작은 터치 타깃 (44px 미만 — 라이브 실측 포함)
- **동의 체크박스 17px**(가입), bulk-checkbox 22px — 약관 동의 탭 어려움
- quick-btn 36px(주석은 "44px 근사"인데 실제 36px), chat-send/mic 36px(gap 8px 인접)
- 랜딩 CTA: `지금 시작하기` 33px·`로그인` 37px(주 전환 버튼), day-chip 38px, 로그인 back 37px
- **수정**: 클릭요소 min-height/min-width 44px, 체크박스는 래퍼 레이블 확대

### T2-3. 회전(resize) 시 학부모 탭바 사라짐
`applyParentUI()`가 `innerWidth<=767`을 1회만 평가, resize 핸들러 없음(madi-app.js:622).
- **수정**: `resize`에 debounce 재평가 또는 CSS 미디어쿼리 이관

### T2-4. 작은 화면서 모달 버튼 화면 밖 (max-height/내부 스크롤 없음)
- postSessionModal(madi-parent.js:31,81) 바텀시트 내부 max-height·overflow 없음
- `.modal-card`/`.pwa-modal`/`.sched-modal` `max-height:90vh`가 iOS 주소창 노출 시 90dvh보다 커 하단 버튼 잘림
- **수정**: `max-height:min(90vh,90dvh)` + 내부 `overflow-y:auto; overscroll-behavior:contain`

### T2-5. 가로모드 좌우 safe-area 미적용 → 노치 가림
본문/모달(`.content`:276, `.dash-content`:1055, 바텀시트)에 `safe-area-inset-left/right` 없음.

### T2-6. admin.html 100vh dvh 폴백 누락
sidenav `calc(100vh-60px)`(:103) 등 → iPhone 주소창 계산에서 잘림. dvh 폴백 추가.

---

## Tier 3 — 다듬기 (여유 시)
- 비번변경 모달 autocomplete 누락(패스워드매니저 미연동), 한글 이름 input autocapitalize
- 학부모 관찰 textarea `resize:vertical` → 모바일 핸들 노출(`resize:none`)
- 브레이크포인트 767/768 혼재(768px 태블릿 충돌)
- 빠른기록 받아쓰기·AI 버튼이 상단 우측(엄지존 밖) → 하단 이동 검토
- 학부모 일정 카드 클릭 무반응(피드백 없음), 알림 항목 role/tabindex/active 피드백 없음
- `_initParentSidebar` 인라인 style 하드코딩(다크·반응형·safe-area 미적용) — 구조 리팩토링
- 인라인 폰트/폭 하드코딩(quick 빈상태 42px, 학부모 온보딩 카드 등) 초소형 단말 압박
- dp-p-hero-next min-width:160px, score-label width:100px, lp-hp-stats 3열 — 360px 과밀
- 채팅창 iOS 키보드 가림(visualViewport 보정), PWA 가이드 popstate가 display:none 요소 remove(기능버그)

---

## PWA — 전 항목 통과 ✓
manifest(display=standalone/orientation/icons/theme_color), apple-touch-icon, viewport-fit=cover, 외부링크 noopener 정상.

## 권고
Tier 1·2 대부분이 **CSS 1~2줄 또는 input 속성 추가**라 일괄 배치 수정 가능. T1-1(아이디 자동대문자)은 베타 직전 최우선 — 신규 가입자가 로그인 못 하는 사고로 직결.
