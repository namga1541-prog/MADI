# 아이마디아이 (MADI) — Claude 작업 가이드

## 프로젝트 개요
언어치료 센터 전용 관리 웹앱. GitHub Pages 정적 배포 (빌드 도구 없음).
- 운영 URL: `https://namga1541-prog.github.io/MADI/`
- 백엔드: Supabase (REST API + Edge Functions)
- 인증: 자체 JWT (Edge Function `/login`)

## 파일 구조
| 파일 | 역할 |
|------|------|
| `index.html` | 메인 앱 (선생님/관리자 UI) |
| `admin.html` | 관리자 센터 |
| `madi-01.js` | 로그인, 공통 유틸, supaFetch |
| `madi-02.js` | 세션 기록 |
| `madi-03.js` | 홈·네비게이션·공지·서비스 설정 |
| `madi-03-dashboard.js` | 페르소나별 대시보드 렌더링 (Teacher/Admin) |
| `madi-04.js` | 아동 관리 |
| `madi-05.js` | 아동 상세 |
| `madi-06.js` | 성장 기록 |
| `madi-07.js` | IEP |
| `madi-08.js` | AI 기능 (Anthropic API) |
| `madi-09.js` | 학부모 포털 |
| `madi-10.js` | 스케줄·캘린더 |
| `madi-11.js` | 표준화검사 (AI 언어평가) |
| `madi-12.js` | 감통 평가 + 권한·배포·PWA·IndexedDB·초기화 |
| `madi-12-chat.js` | 플로팅 AI 비서 (chat / 매크로 / 음성) |
| `madi-13.js` | 리포트·장단기계획 |
| `madi-14.js` | 게시판 (공지·고객센터·자료실) |
| `madi-15.js` | 학부모 포털 전용 |
| `madi-16.js` | ⚡ 빠른 기록 모드 (선생님 모바일 우선) |
| `madi-vocab.js` | 한국 임상 어휘 사전 + AI 후처리 검열기 (다른 madi-*.js 보다 먼저 로드) |
| `madi.css` | 전역 스타일 |
| `sw.js` | Service Worker (캐시 — 커밋 시 자동 갱신) |

## 역할 체계
- `superadmin`: 플랫폼 전체 관리자 (username: dinosau)
- `admin`: 센터장
- `teacher`: 선생님
- `parent`: 학부모

## 핵심 규칙

### 코딩 컨벤션
- 바닐라 JS (ES5 호환) — `var`, `function`, `.then()` 사용
- 전역 변수: `childDB`, `sessionDB`, `scheduleDB`, `assessmentDB` 등
- DB 접근: 반드시 `supaFetch()` 경유 (직접 Supabase anon key 사용 금지)
- HTML ID 네이밍: camelCase (`schedChildSel`, `bdPanel_lounge`)

### 보안
- 모든 사용자 입력은 `escHtml()` 처리
- 서버 필터링은 Edge Function에서 수행 — 클라이언트 필터만으로 보안 불가
- RLS 정책이 있으므로 DB 직접 접근 주의

### 배포
- `main` 브랜치 push → GitHub Pages 자동 배포 (1~2분 소요)
- `sw.js` 캐시 버전은 pre-commit 훅이 자동 갱신 (수동 변경 불필요)
- 변경 후 반드시 강제 새로고침 안내 (Ctrl+Shift+R)

### 자동 커밋·푸시 (필수)
- **모든 코드 수정 작업 완료 후 별도 언급 없어도 반드시** `git add -A && git commit && git push origin main` 실행
- worktree에서 작업 시: worktree 커밋 → main에 cherry-pick → push 순서로 진행
- 사용자가 명시적으로 "커밋하지 마" 라고 하지 않는 한 항상 자동 배포까지 완료

### Edge Function 배포
- **반드시 `--no-verify-jwt` 플래그 포함** — 없으면 Supabase 미들웨어가 모든 요청을 401로 차단
  ```
  supabase functions deploy <name> --project-ref ujxdhafzjyrglaclarwe --no-verify-jwt
  ```
- 배포 후 엔드포인트 직접 호출로 동작 확인 필수

### 금지 사항
- `npm install`, `package.json` 의존성 추가 금지 (정적 사이트)
- `console.log` 운영 코드에 추가 금지
- Supabase anon key를 소스에 하드코딩 금지

## DB 스키마 (검증된 컬럼)

Edge Function이나 SQL에서 컬럼을 참조할 때는 아래 목록 기준으로 확인할 것.
존재하지 않는 컬럼을 select에 포함하면 PostgREST가 400을 반환하고, 에러 메시지가 인증 실패처럼 보일 수 있음.

| 테이블 | 컬럼 |
|--------|------|
| `madi_users` | `id`, `username`, `name`, `password`, `role`, `center_id`, `color`, `permissions`, `password_changed_at`, `status` |
| `madi_parent_children` | `parent_user_id`, `child_id`, `center_id` |
| `madi_centers` | `id` (PK, center_id로 사용) |
| `madi_notifications` | `id`, `user_id`, `center_id`, `type`, `title`, `body`, `link`, `read_at`, `created_at` |
| `madi_audit_log` | `id`, `actor_id`, `actor_name`, `action`, `table_name`, `record_id`, `child_id`, `changed_cols`, `occurred_at` |
| `madi_portfolios` | `id`, `child_id`, `center_id`, `parent_visible`, `created_by`, `opened_by`, `data`, `created_at` |
| `madi_rate_limits` | `key` (PK), `count`, `window_start`, `hour_count`, `hour_start`, `updated_at` |
| `madi_push_subscriptions` | `id`, `user_id`, `endpoint`, `p256dh`, `auth`, `created_at` |
| `madi_push_settings` | `center_id`, `enabled`, `push_time`, `message_title`, `message_body`, `last_sent_date` |
| `madi_settings` | `key` (PK), `value` — **전역 테이블, center_id 컬럼 없음** |

> 위 목록에 없는 컬럼을 추가하려면 코드와 DB 스키마를 동시에 수정해야 함.
> SQL 파일 실행 순서는 [MIGRATIONS_RUNBOOK.md](./MIGRATIONS_RUNBOOK.md) 참고.

## 테스트
```bash
node tests/smoke.js   # 유틸 함수 유닛 테스트
```
pre-commit 훅에서 자동 실행됨.

## 자주 쓰는 패턴

### supaFetch 사용
```js
supaFetch('madi_users?id=eq.' + id, 'GET')
  .then(function(rows) { ... })
  .catch(function(err) { showToast('⚠️ ' + err.message); });
```

### 토스트 메시지
```js
showToast('✅ 저장됨');   // 성공
showToast('⚠️ 오류');    // 경고
```

### 역할 분기
```js
if (currentUser.role === 'superadmin') { ... }
else if (currentUser.role === 'admin') { ... }
else { ... } // teacher
```
