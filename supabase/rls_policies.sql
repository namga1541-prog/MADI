-- ============================================================
-- MADI RLS (Row-Level Security) 정책 마이그레이션
-- 목적: Edge Function의 서버 사이드 필터링에 더해 DB 계층에서
--       방어 심층(defense-in-depth)을 구현한다.
--
-- ⚠️  주의
--   - 모든 앱 DB 접근은 Edge Function(service_role_key)을 통하므로
--     RLS는 직접 anon/authenticated 키 접근을 차단하는 역할을 한다.
--   - service_role 은 RLS를 우회(bypass)하므로 이 파일 적용 후에도
--     기존 Edge Function 동작은 변경되지 않는다.
--   - Supabase Dashboard → SQL Editor 에서 순서대로 실행하면 된다.
--
-- 실행 순서: MIGRATIONS_RUNBOOK.md 참고
-- 최초 작성: 2026-05-24
-- ============================================================

-- ─────────────────────────────────────────────────────────────
-- 0. RLS 활성화
-- ─────────────────────────────────────────────────────────────
ALTER TABLE madi_users            ENABLE ROW LEVEL SECURITY;
ALTER TABLE madi_centers          ENABLE ROW LEVEL SECURITY;
ALTER TABLE madi_audit_log        ENABLE ROW LEVEL SECURITY;
ALTER TABLE madi_notifications    ENABLE ROW LEVEL SECURITY;
ALTER TABLE madi_portfolios       ENABLE ROW LEVEL SECURITY;
ALTER TABLE madi_rate_limits      ENABLE ROW LEVEL SECURITY;
ALTER TABLE madi_push_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE madi_push_settings    ENABLE ROW LEVEL SECURITY;
ALTER TABLE madi_settings         ENABLE ROW LEVEL SECURITY;
ALTER TABLE madi_parent_children  ENABLE ROW LEVEL SECURITY;

-- ─────────────────────────────────────────────────────────────
-- 1. madi_users — 자기 자신만 SELECT, 관리자만 동 센터 조회
-- ─────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "users_select_self"    ON madi_users;
DROP POLICY IF EXISTS "users_select_center"  ON madi_users;
DROP POLICY IF EXISTS "users_insert_blocked" ON madi_users;
DROP POLICY IF EXISTS "users_update_self"    ON madi_users;
DROP POLICY IF EXISTS "users_delete_blocked" ON madi_users;

-- anon/authenticated 는 직접 SELECT 불가 (서비스 롤만 가능)
CREATE POLICY "users_select_blocked" ON madi_users
  FOR SELECT USING (false);

CREATE POLICY "users_write_blocked" ON madi_users
  FOR ALL USING (false);

-- ─────────────────────────────────────────────────────────────
-- 2. madi_centers — 직접 접근 전면 차단
-- ─────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "centers_all_blocked" ON madi_centers;
CREATE POLICY "centers_all_blocked" ON madi_centers
  FOR ALL USING (false);

-- ─────────────────────────────────────────────────────────────
-- 3. madi_audit_log — 직접 접근 전면 차단
-- ─────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "auditlog_all_blocked" ON madi_audit_log;
CREATE POLICY "auditlog_all_blocked" ON madi_audit_log
  FOR ALL USING (false);

-- ─────────────────────────────────────────────────────────────
-- 4. madi_notifications — 직접 접근 전면 차단
-- ─────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "notifications_all_blocked" ON madi_notifications;
CREATE POLICY "notifications_all_blocked" ON madi_notifications
  FOR ALL USING (false);

-- ─────────────────────────────────────────────────────────────
-- 5. madi_portfolios — 직접 접근 전면 차단
-- ─────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "portfolios_all_blocked" ON madi_portfolios;
CREATE POLICY "portfolios_all_blocked" ON madi_portfolios
  FOR ALL USING (false);

-- ─────────────────────────────────────────────────────────────
-- 6. madi_rate_limits — 직접 접근 전면 차단
-- ─────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "rate_limits_all_blocked" ON madi_rate_limits;
CREATE POLICY "rate_limits_all_blocked" ON madi_rate_limits
  FOR ALL USING (false);

-- ─────────────────────────────────────────────────────────────
-- 7. madi_push_subscriptions — 직접 접근 전면 차단
-- ─────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "push_sub_all_blocked" ON madi_push_subscriptions;
CREATE POLICY "push_sub_all_blocked" ON madi_push_subscriptions
  FOR ALL USING (false);

-- ─────────────────────────────────────────────────────────────
-- 8. madi_push_settings — 직접 접근 전면 차단
-- ─────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "push_settings_all_blocked" ON madi_push_settings;
CREATE POLICY "push_settings_all_blocked" ON madi_push_settings
  FOR ALL USING (false);

-- ─────────────────────────────────────────────────────────────
-- 9. madi_settings (전역 키-값) — 직접 접근 전면 차단
-- ─────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "settings_all_blocked" ON madi_settings;
CREATE POLICY "settings_all_blocked" ON madi_settings
  FOR ALL USING (false);

-- ─────────────────────────────────────────────────────────────
-- 10. madi_parent_children — 직접 접근 전면 차단
-- ─────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "parent_children_all_blocked" ON madi_parent_children;
CREATE POLICY "parent_children_all_blocked" ON madi_parent_children
  FOR ALL USING (false);

-- ─────────────────────────────────────────────────────────────
-- 완료 확인
-- 아래 쿼리로 정책 목록을 확인한다.
-- SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual
-- FROM pg_policies
-- WHERE schemaname = 'public'
-- ORDER BY tablename, policyname;
-- ─────────────────────────────────────────────────────────────
