# MADI 앱 — SQL 마이그레이션 실행 순서

Supabase 신규 프로젝트 셋업 또는 기존 프로젝트 동기화 시 아래 순서대로 SQL Editor 에서 실행한다.
모든 파일은 `IF NOT EXISTS` / `DROP POLICY IF EXISTS` 패턴으로 멱등하게 작성되어 있으므로 재실행해도 안전하다.

## 0. 사전 준비

- Supabase Dashboard > Database > Extensions 에서 다음 활성화:
  - `pg_cron` (daily_digest_setup.sql 에서 필요)
  - `uuid-ossp` 또는 `pgcrypto` (UUID 생성, 보통 기본 활성)

## 1. 핵심 RLS 토대 (필수, 1순위)

```
rls_security_setup.sql
```

- 헬퍼 함수 생성: `madi_my_center_id()`, `madi_my_role()`
- 모든 사용자 데이터 테이블에 RLS 활성화
- 기본 SELECT/INSERT/UPDATE/DELETE 정책 정의

## 1-B. 직접 접근 차단 정책 — **⚠️ 미실행 시 anon key로 DB 직접 접근 가능**

```
supabase/rls_policies.sql
```

- 관리·보조 테이블(10개) RLS 활성화 + anon/authenticated 직접 접근 전면 차단
  - `madi_users`, `madi_centers`, `madi_audit_log`, `madi_notifications`, `madi_portfolios`,
    `madi_rate_limits`, `madi_push_subscriptions`, `madi_push_settings`, `madi_settings`,
    `madi_parent_children`
- **service_role(Edge Function)은 RLS를 우회하므로 기존 앱 동작은 무변경**
- 이 파일을 실행하지 않으면 RLS가 꺼진 상태로 운영 중인 것임
- Supabase Dashboard → SQL Editor → 전체 내용 붙여넣기 → Run

## 1-C. 핵심 업무 테이블 차단 정책 (1-B 의존, 2026-05-26 추가)

```
supabase/rls_core_tables.sql
```

- 핵심 업무 테이블(11개) RLS 활성화 + anon/authenticated 직접 접근 전면 차단
  - `madi_children`, `madi_sessions`, `madi_schedules`, `madi_assessments`, `madi_iep_history`,
    `madi_notices`, `madi_global_notices`, `madi_lounge_posts`, `madi_lounge_comments`,
    `madi_activities`, `madi_error_logs`
- 1-B와 동일한 `FOR ALL USING (false)` 패턴, service_role 우회 동일
- **반드시 1-B 적용 이후 실행**
- 적용 후 파일 하단 주석의 확인 쿼리로 11개 행 모두 `qual: false` 검증

## 2. 학부모 격리 (1번 의존)

```
parent_isolation_rls.sql
```

- 1번에서 만든 헬퍼 함수 사용
- 학부모 role 전용 추가 SELECT 정책 (child_id 기반 격리)

## 3. Storage 정책

```
storage_policies_tighten.sql
```

- Storage 버킷의 RLS 강화 (board-images 등)

## 4. 작성자 추적 트리거 + 마이그레이션 (체이닝 주의)

순서대로:
```
1. author_id_migration.sql            (madi_*_posts 등에 author_id 컬럼 추가 + 백필)
2. author_name_enforce_trigger.sql    (trigger 함수 생성)
3. notices_author_id_migration.sql    (trigger 활용해 notices 백필)
```

## 5. 보조 기능 (독립)

순서 무관, 필요한 것만 실행:
```
assessments_user_id_migration.sql   — 평가에 user_id 추가
audit_log_setup.sql                 — 감사 로그
rate_limits_setup.sql               — Edge Function rate limit 백엔드
session_invalidation_setup.sql      — 비밀번호 변경 시 세션 무효화
session_security_setup.sql          — 강제 로그아웃·계정 잠금 컬럼 (SEC3+SEC4, 2026-05-24)
madi_notifications_setup.sql        — 앱 내 알림
madi_portfolios_setup.sql           — 학부모 포트폴리오
madi_push_setup.sql                 — Web Push 구독
login_popup_setup.sql               — 로그인 후 1회성 팝업
prog_types_migration.sql            — 선생님 담당 프로그램 유형 컬럼 추가 (admin 교사관리)
```

## 6. 자동화 (5번 의존)

```
daily_digest_setup.sql
```

- `madi_audit_log`, `madi_error_logs`, `madi_notifications` 테이블 필요
- `pg_cron` 확장 필수 (0번 사전 준비)

## 검증

각 단계 후 다음 쿼리로 확인:

```sql
-- RLS 활성화 확인
SELECT tablename, rowsecurity
FROM   pg_tables
WHERE  schemaname = 'public' AND tablename LIKE 'madi_%';

-- 정책 목록
SELECT tablename, policyname, cmd
FROM   pg_policies
WHERE  schemaname = 'public' AND tablename LIKE 'madi_%'
ORDER  BY tablename, policyname;

-- pg_cron 작업 확인
SELECT jobname, schedule, active FROM cron.job;
```

### 정상 상태 baseline (1-B + 1-C 적용 후 기대 결과)

신규 환경 셋업이나 운영 점검 시 위 쿼리 결과를 아래 baseline과 비교해 회귀 여부를 확인한다.

#### ① RLS 활성화 — 21개 테이블 모두 `rowsecurity = true`

| tablename | rowsecurity |
|-----------|-------------|
| madi_activities | t |
| madi_assessments | t |
| madi_audit_log | t |
| madi_centers | t |
| madi_children | t |
| madi_error_logs | t |
| madi_global_notices | t |
| madi_iep_history | t |
| madi_lounge_comments | t |
| madi_lounge_posts | t |
| madi_notices | t |
| madi_notifications | t |
| madi_parent_children | t |
| madi_portfolios | t |
| madi_push_settings | t |
| madi_push_subscriptions | t |
| madi_rate_limits | t |
| madi_schedules | t |
| madi_sessions | t |
| madi_settings | t |
| madi_users | t |

→ 행 수 21, `f`(false) 단 1행도 없어야 정상.

#### ② 차단 정책 — 모든 정책의 `qual = false`

| 출처 SQL | 정책명 패턴 | 대상 테이블 |
|----------|------------|------------|
| `rls_policies.sql` (1-B) | `<table>_all_blocked` (또는 users는 `*_blocked`) | 10개 |
| `rls_core_tables.sql` (1-C) | `<table>_all_blocked` | 11개 |

정책 행 합계 **22개 이상** (madi_users는 `users_select_blocked` + `users_write_blocked` 2건).
모든 행의 `qual` 컬럼이 `false` 가 아니면 즉시 점검.

#### ③ pg_cron 작업 — `daily_digest_setup.sql` 적용 시

| jobname | active |
|---------|--------|
| (예) `madi-daily-digest` | t |

`daily_digest_setup.sql` 미적용 환경에서는 빈 결과여도 정상.

### 회귀 감지 워크플로우

운영 점검 시:
1. 위 3개 검증 쿼리를 SQL Editor에서 실행
2. 결과를 위 baseline 표와 시각 비교
3. 불일치가 있다면:
   - 누락 테이블 → 해당 SQL 파일 재실행 (멱등 작성됨)
   - `qual ≠ false` 정책 → 누군가 정책을 수정한 흔적, audit_log 점검
   - `rowsecurity = f` → 비상 롤백 절차가 가동된 상태일 가능성

> baseline 변경 시 이 표도 함께 갱신할 것.

## 롤백 시

`rls_security_setup.sql` 적용 후 문제가 생기면 RLS 비활성화로 임시 우회:

```sql
ALTER TABLE madi_children DISABLE ROW LEVEL SECURITY;
-- 등 필요한 테이블만
```

이후 정책을 수정해 다시 적용. 운영 환경에서는 RLS 비활성 상태를 길게 유지하지 말 것.
