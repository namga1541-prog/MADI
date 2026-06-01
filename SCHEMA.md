# MADI DB 스키마 — 단일 정본 (Single Source of Truth)

> **스키마는 여기서만 관리한다.** CLAUDE.md·slim-context·에이전트 브리핑은 이 파일을 참조만 한다(중복 금지 → 드리프트 방지).
> 존재하지 않는 컬럼을 `select`/`POST` 에 넣으면 PostgREST 가 400(42703)을 반환하고, 에러가 인증 실패처럼 보일 수 있다.
> 변경 시: 이 파일 + 해당 SQL 마이그레이션을 함께 수정. 실행 순서는 [MIGRATIONS_RUNBOOK.md](./MIGRATIONS_RUNBOOK.md).

## 임상 데이터 테이블 (제네릭 구조)
`madi_children` · `madi_sessions` · `madi_schedules` · `madi_assessments` · `madi_iep_history` · `madi_activities`
- 공통 컬럼: **`id`(text PK), `center_id`(text), `data`(JSONB — 실제 필드 전체)**
- 추가 실컬럼(테이블별): `madi_schedules.child_id`, `madi_portfolios.child_id`/`parent_visible`, `madi_assessments.user_id`
- 학부모 격리는 `data->>childId` 또는 `child_id` 컬럼으로 (RLS/프록시가 강제 — [ARCHITECTURE.md](./ARCHITECTURE.md) 참조)

## 메타·운영 테이블 (명시 컬럼)
| 테이블 | 컬럼 |
|--------|------|
| `madi_users` | `id`, `username`, `name`, `password`, `role`, `center_id`, `color`, `permissions`, `password_changed_at`, `session_revoked_at`, `failed_login_count`, `last_failed_at`, `locked_until`, `login_attempts`, `totp_secret`, `totp_enabled`, `totp_enrolled_at`, `totp_last_step`, `created_at`, `prog_types`(JSONB) — ⚠️ **`status` 컬럼 없음** (POST 주입 시 400) |
| `madi_parent_children` | `parent_user_id`, `child_id`, `center_id` |
| `madi_centers` | `id`(PK, center_id로 사용), `name`, `invite_code`, `invite_expires_at`, `session_interval` |
| `madi_notifications` | `id`, `user_id`, `center_id`, `type`, `title`, `body`, `link`, `read_at`, `created_at` |
| `madi_audit_log` | `id`, `occurred_at`, `actor_id`, `actor_role`, `action`, `table_name`, `row_id`, `center_id`, `child_id`, `changed_cols`(text[]), `client_ip`, `user_agent` |
| `madi_portfolios` | `id`, `child_id`, `center_id`, `parent_visible`, `created_by`, `created_by_name`, `opened_by`, `opened_at`, `month`, `content`, `data`, `created_at` |
| `madi_rate_limits` | `key`(PK), `count`, `window_start`, `hour_count`, `hour_start`, `updated_at` |
| `madi_push_subscriptions` | `id`, `user_id`, `endpoint`, `p256dh`, `auth`, `center_id`, `created_at` |
| `madi_push_settings` | `center_id`, `enabled`, `push_time`, `message_title`, `message_body`, `last_sent_date` |
| `madi_settings` | `key`(PK), `value` — **전역 테이블, center_id 컬럼 없음** |
| `madi_lounge_posts` | `id`, `center_id`, `author_id`, `author_name`, `author_role`, `title`, `content`, `images`, `image_urls`, `note`, `visibility`, `created_at` |
| `madi_lounge_comments` | `id`, `post_id`, `center_id`, `author_id`, `author_name`, `author_role`, `content`, `created_at` |
| `madi_error_logs` | `user_id`, `username`, `message`, `source`, `user_agent`, `url`, `ts`, `created_at` |
| `madi_parent_observations` | `id`, `parent_user_id`, `child_id`, `center_id`, `content`, `teacher_reply`, `created_at` |
| `madi_center_api_keys` | (마이그레이션 `migrations/add_center_api_keys.sql` 참조 — 센터별 API 키) |
