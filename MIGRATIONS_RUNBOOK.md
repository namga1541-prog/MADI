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

## 롤백 시

`rls_security_setup.sql` 적용 후 문제가 생기면 RLS 비활성화로 임시 우회:

```sql
ALTER TABLE madi_children DISABLE ROW LEVEL SECURITY;
-- 등 필요한 테이블만
```

이후 정책을 수정해 다시 적용. 운영 환경에서는 RLS 비활성 상태를 길게 유지하지 말 것.
