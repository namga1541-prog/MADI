# MADI 앱 — SQL 마이그레이션 실행 순서

Supabase 신규 프로젝트 셋업 또는 기존 프로젝트 동기화 시 아래 순서대로 SQL Editor 에서 실행한다.
모든 파일은 `IF NOT EXISTS` / `DROP POLICY IF EXISTS` 패턴으로 멱등하게 작성되어 있으므로 재실행해도 안전하다.

## 0. 사전 준비

- Supabase Dashboard > Database > Extensions 에서 다음 활성화:
  - `pg_cron` (daily_digest_setup.sql 에서 필요)
  - `uuid-ossp` 또는 `pgcrypto` (UUID 생성, 보통 기본 활성)

### 0-A. 코어 테이블 DDL — ⚠️ **신규(빈) 환경에서만**, 추정본

```
supabase/core_tables_ddl_inferred.sql
```

- 코어 임상 5개 테이블(`madi_children`/`sessions`/`schedules`/`assessments`/`iep_history`)의
  `CREATE TABLE IF NOT EXISTS` 정의. **레포에 코어 DDL 이 없어** 신규 환경 재현용으로 추가.
- ⚠️ **추정본이다.** SCHEMA.md + 코드 사용 패턴으로 역설계한 것이며 타입·제약 보장 불가.
  - **운영/기존 DB**: 이미 테이블이 존재 → `IF NOT EXISTS` 가 no-op, **실행해도 무해**(데이터 불변).
  - **실측 교체 필수**: `supabase db dump --schema-only --project-ref ujxdhafzjyrglaclarwe`
    로 실제 DDL 을 받아 이 파일을 실측본으로 교체한 뒤 신규 환경에 사용할 것.
- 인덱스·RLS 는 이 파일에 없음 → 아래 0-B, 1-C 에서 별도 적용.

### 0-B. 코어 테이블 인덱스 — **[HIGH] 성능**, 비파괴적

```
supabase/add_core_indexes.sql
```

- 코어 5개 테이블에 인덱스 추가(기존 인덱스 0개 → 시퀀셜 스캔 제거). **비파괴적·멱등**(`IF NOT EXISTS`).
- 생성 인덱스: `idx_children_center`, `idx_sessions_center_date`/`_center_child`,
  `idx_schedules_center_date`/`_center_child`, `idx_assessments_center_date`/`_center_child`,
  `idx_iep_history_center_date`/`_center_child`.
  - 표현식은 라이브 쿼리와 동형: `(center_id, (data->>'date'))`, `(center_id, (data->>'childId'))`.
- ⚠️ **`CREATE INDEX CONCURRENTLY` 는 트랜잭션 밖에서 한 줄씩 실행**해야 한다.
  - 운영 DB(특히 `madi_schedules` 1700+행): 각 `CREATE INDEX` 문을 **하나씩 따로** SQL Editor 에서 Run.
    전체를 한 번에 Run 하면 "cannot run inside a transaction block" 오류.
  - 신규/소규모 환경: `CONCURRENTLY` 를 빼고 통째 Run 해도 무방(짧은 잠금).
- 적용 후 `EXPLAIN ANALYZE` 로 `Index Scan` 사용 확인(파일 하단 검증 쿼리).
- 언제든 실행 가능(앱 동작 불변). 운영 반영 권장 0순위.

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

## 1-D. 죽은 RLS 정책 정리 — **[MED] 선택, 동작 불변**

```
supabase/rls_cleanup_dead_policies.sql
```

- `/api` 가 service_role 로 RLS 를 우회하고 자체 JWT 라 `auth.uid()` 가 NULL 이므로,
  `rls_security_setup.sql`·`parent_isolation_rls.sql` 의 **role 기반 정책은 모두 죽은(무효) 정책**이다.
  인가의 SSOT 는 `supabase/functions/api/index.ts`.
- 이 파일은 그 죽은 permissive 정책들을 `DROP POLICY IF EXISTS` 로 정리한다(감사 노이즈 제거).
  - ⚠️ **`*_all_blocked`/`*_blocked`(USING(false)) 차단 정책은 유지** — anon-key 우발 노출 방어선(1-C, 1-B).
  - ⚠️ `storage_policies_tighten.sql` 도 유지(실효).
  - 헬퍼 함수(`madi_my_role` 등)는 미래 Supabase Auth 전환 대비로 **삭제하지 않음**.
- **동작 불변**: service_role 경로라 죽은 정책을 지우든 두든 앱 동작 동일. **실행은 선택**(문서로만 둬도 무해).
- 파일 상단에 테이블별 DEAD/KEEP 참조표(감사 SSOT) 포함.
- ⚠️ **미래에 진짜 `auth.uid()` 경로로 전환하면** role 정책 재적용이 필요하므로 이 DROP 을 실행하지 말 것.

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
