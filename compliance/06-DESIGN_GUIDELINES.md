# MADI 디자인 가이드라인

> 디자인 진단 후 정립된 운용 규칙. 신규 코드는 이 규칙을 따른다.
> 시각 검수: [design-system.html](../design-system.html) 페이지 활용.

## 🎯 핵심 원칙
1. **신뢰가 첫 번째** — 의료 데이터를 다루므로 차분하고 정돈된 톤
2. **일관성이 두 번째** — 같은 컴포넌트는 같은 규칙
3. **변경 가능성이 세 번째** — 토큰 기반, hex 직접 사용 금지

---

## 1. 컬러

### 1.1 토큰만 사용
```css
/* ✅ */  color: var(--mint);
/* ❌ */  color: #0ea5a0;
```

### 1.2 시맨틱 컬러 매핑
| 의미 | 토큰 | 사용 예 |
|------|------|--------|
| 정보 | `--color-info` (#3b82f6) | 안내 배너 |
| 성공 | `--color-success` (#10b981) | 저장 완료 토스트 |
| 경고 | `--color-warning` (#f59e0b) | 종결·일정 변경 |
| 위험 | `--color-danger` (#ef4444) | 삭제·취소 |

### 1.3 브랜드 그라데이션
**한 가지만 사용**: `var(--grad-brand)`. 헤더·hero·핵심 CTA 강조에만.

---

## 2. 타이포그래피

### 2.1 8단계 스케일
| 토큰 | px | 용도 |
|------|----|------|
| `--fs-3xl` | 28 | hero |
| `--fs-2xl` | 22 | 페이지 제목 |
| `--fs-xl`  | 18 | 섹션 제목 |
| `--fs-lg`  | 16 | 인풋·강조 |
| `--fs-md`  | 15 | 카드 제목 |
| `--fs-base`| 14 | 본문 |
| `--fs-sm`  | 12 | 라벨·캡션 |
| `--fs-xs`  | 11 | 메타 정보 |

> **금지**: 10px, 10.5px, 13px, 17px, 19px 등 단계 외 값
> **예외**: 모바일에서 16px 인풋(자동 줌 방지)은 시스템이 강제

### 2.2 font-weight 5단계만
400 / 500 / 600 / 700 / 900

### 2.3 line-height
- 본문: 1.6 ~ 1.8
- 제목: 1.2 ~ 1.4
- 모달·캡션: 1.5 ~ 1.7

---

## 3. Spacing — 4px grid

```
4 · 8 · 12 · 16 · 20 · 24 · 32 · 40
```

토큰: `var(--space-1)` ~ `var(--space-8)`

> **금지**: 5, 7, 9, 11, 13, 15, 17, 18 등 홀수·중간값
> **이유**: 디자이너의 눈은 grid 를 읽음. 1px 어긋남이 "어색한데 왜인지 모를 느낌"의 원인.

---

## 4. Border Radius — 4단계

| 토큰 | px | 용도 |
|------|----|------|
| `--r-sm`   | 8    | 칩·뱃지·작은 input |
| `--r-md`   | 12   | 인풋·버튼·dropdown |
| `--r-lg`   | 16   | 카드 |
| `--r-xl`   | 20   | 모달 |
| `--r-full` | 9999 | 알약·아바타 |

---

## 5. 아이콘 — 이모지 금지

### 5.1 신규 코드
- ✅ `<span data-icon="home"></span>` 또는 `mdIcon('home', 20)`
- ❌ 🏠, 📅, 👤 등 이모지 직접 삽입

### 5.2 기존 코드
점진적 교체. 새 기능엔 무조건 SVG.

### 5.3 아이콘 카탈로그
[design-system.html](../design-system.html) → "6. 아이콘" 섹션에서 확인.

### 5.4 예외
- 종결 사유, 진단명 등 **의미가 이모지에 본질적인 곳**은 유지
- 토스트 첫 글자(✅ ⚠️ ❌)는 빠른 인지를 위해 유지

---

## 6. 컴포넌트 규칙

### 6.1 버튼
| 클래스 | 사용 |
|--------|------|
| `.btn.btn-primary` | **페이지당 1~2개만** — 가장 중요한 액션 |
| `.btn.btn-outline` | 부차 액션 |
| `.btn.btn-ghost` | 취소·닫기 |
| `.btn.btn-del` | 정말 위험할 때만 — 삭제·강제 종료 |

### 6.2 카드 좌측 강조선
| 색 | 의미 |
|----|------|
| 없음 | 일반 정보 |
| `--mint` | 브랜드·신규·핵심 |
| `--color-warning` | 주의·정체 |
| `--color-danger` | 위험·에러 |
| `--purple` | AI 응답 (특별 카테고리) |

> **금지**: 위 5개 외 자유색. indigo, pink 등 임의 추가 금지.

### 6.3 모달
- 인라인 `style="..."` 금지
- `.modal-overlay .modal-card .modal-header .modal-actions` 구조 사용
- `showConfirm()` / `showInputPrompt()` 가 우선

### 6.4 빈 상태
텍스트만 절대 금지. `mdEmptyState({ illust, title, desc, cta })` 사용.

### 6.5 로딩
- 짧은 액션(< 1초): 토스트 또는 버튼 상태만
- 긴 데이터 로딩(1초 +): `mdSkeletonList(n)` 스켈레톤
- 단순 spinner 는 마지막 옵션

---

## 7. 인라인 스타일 정책

### 7.1 신규 코드 — 금지
```html
<!-- ❌ -->
<div style="padding: 16px; background: white; border-radius: 12px;">

<!-- ✅ -->
<div class="card">
```

### 7.2 예외 허용
- 동적 값 (사용자 색상, 차트 너비 등)
- 임시 데모·디자인 카탈로그
- inline display none/block 토글 (legacy)

---

## 8. 다크모드 체크리스트

신규 컴포넌트 추가 시:
- [ ] `body.dark-mode .my-component` 오버라이드 작성
- [ ] 배경·텍스트 대비비 WCAG AA (4.5:1) 이상
- [ ] 그림자는 더 강하게 (다크에선 잘 안 보임)
- [ ] hover/active 상태도 다크에서 시각화 확인
- [ ] [design-system.html](../design-system.html) 다크모드로 검수

---

## 9. 접근성 — 무조건 충족

| 항목 | 기준 |
|------|------|
| 색맹 대응 | 색만으로 정보 전달 X (아이콘·텍스트 병행) |
| 텍스트 대비비 | 본문 4.5:1, 큰 텍스트(18px+) 3:1 |
| 터치 타깃 | 최소 44 × 44 px |
| 키보드 네비 | Tab 순환, ESC 닫기, Enter 제출 |
| 스크린리더 | aria-label, role, aria-modal |
| 줌 | 최대 5배까지 허용 (viewport `maximum-scale` 금지) |

---

## 10. 변경 프로세스

### 10.1 토큰 변경 시
1. [design-system.html](../design-system.html) 미리보기에서 전체 영향 확인
2. 다크모드 전환해서 한 번 더 확인
3. 라이트하우스 접근성 점수 90+ 유지 확인

### 10.2 신규 컴포넌트 추가 시
1. 본 가이드 규칙 준수 확인
2. design-system.html 에 데모 추가
3. 다크모드 오버라이드 작성
4. 모바일·PC 양쪽 스크린샷 첨부 PR

### 10.3 디자인 부채 정리 (월 1회)
- 인라인 `style="..."` 카운트 측정
- 이모지 카운트 측정
- font-size·padding 종류 카운트
- 직전 월 대비 추이 보고

---

## 11. 도구

| 도구 | 용도 |
|------|------|
| [design-system.html](../design-system.html) | 시각 검수 |
| Chrome DevTools | 대비비 검사 (Inspect → Accessibility) |
| Lighthouse | 접근성·성능 점수 |
| WebAIM Contrast Checker | https://webaim.org/resources/contrastchecker/ |
| Lucide Icons | https://lucide.dev (madi-icons.js 미포함 아이콘 검색) |

---

## 개정 이력

| 버전 | 일자 | 변경 |
|------|------|------|
| v1.0 | 2026-05-24 | 디자인 진단 후 최초 작성 — 8단 토큰·아이콘 시스템·모달 클래스화 |
