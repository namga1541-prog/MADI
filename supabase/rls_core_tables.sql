-- ============================================================
-- MADI RLS — 핵심 업무 테이블 (Core Tables)
-- 목적: rls_policies.sql에서 누락된 11개 핵심 업무 테이블에
--       직접 접근을 전면 차단한다.
--
-- ⚠️  주의
--   - service_role(Edge Function)은 RLS를 우회(bypass)하므로
--     기존 앱 동작은 변경되지 않는다.
--   - anon/authenticated 키로 직접 REST 호출 시 전면 차단된다.
--   - Supabase Dashboard → SQL Editor 에서 실행할 것.
--
-- 실행 전 조건: rls_policies.sql이 이미 적용되어 있어야 함.
-- 최초 작성: 2026-05-26
-- ============================================================

-- ─────────────────────────────────────────────────────────────
-- 1. madi_children — 아동 정보
-- ─────────────────────────────────────────────────────────────
ALTER TABLE madi_children ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "children_all_blocked" ON madi_children;
CREATE POLICY "children_all_blocked" ON madi_children
  FOR ALL USING (false);

-- ─────────────────────────────────────────────────────────────
-- 2. madi_sessions — 세션 기록
-- ─────────────────────────────────────────────────────────────
ALTER TABLE madi_sessions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "sessions_all_blocked" ON madi_sessions;
CREATE POLICY "sessions_all_blocked" ON madi_sessions
  FOR ALL USING (false);

-- ─────────────────────────────────────────────────────────────
-- 3. madi_schedules — 스케줄·캘린더
-- ─────────────────────────────────────────────────────────────
ALTER TABLE madi_schedules ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "schedules_all_blocked" ON madi_schedules;
CREATE POLICY "schedules_all_blocked" ON madi_schedules
  FOR ALL USING (false);

-- ─────────────────────────────────────────────────────────────
-- 4. madi_assessments — 표준화검사
-- ─────────────────────────────────────────────────────────────
ALTER TABLE madi_assessments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "assessments_all_blocked" ON madi_assessments;
CREATE POLICY "assessments_all_blocked" ON madi_assessments
  FOR ALL USING (false);

-- ─────────────────────────────────────────────────────────────
-- 5. madi_iep_history — IEP 기록
-- ─────────────────────────────────────────────────────────────
ALTER TABLE madi_iep_history ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "iep_history_all_blocked" ON madi_iep_history;
CREATE POLICY "iep_history_all_blocked" ON madi_iep_history
  FOR ALL USING (false);

-- ─────────────────────────────────────────────────────────────
-- 6. madi_notices — 센터 공지
-- ─────────────────────────────────────────────────────────────
ALTER TABLE madi_notices ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "notices_all_blocked" ON madi_notices;
CREATE POLICY "notices_all_blocked" ON madi_notices
  FOR ALL USING (false);

-- ─────────────────────────────────────────────────────────────
-- 7. madi_global_notices — 글로벌 공지
-- ─────────────────────────────────────────────────────────────
ALTER TABLE madi_global_notices ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "global_notices_all_blocked" ON madi_global_notices;
CREATE POLICY "global_notices_all_blocked" ON madi_global_notices
  FOR ALL USING (false);

-- ─────────────────────────────────────────────────────────────
-- 8. madi_lounge_posts — 라운지 게시글
-- ─────────────────────────────────────────────────────────────
ALTER TABLE madi_lounge_posts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "lounge_posts_all_blocked" ON madi_lounge_posts;
CREATE POLICY "lounge_posts_all_blocked" ON madi_lounge_posts
  FOR ALL USING (false);

-- ─────────────────────────────────────────────────────────────
-- 9. madi_lounge_comments — 라운지 댓글
-- ─────────────────────────────────────────────────────────────
ALTER TABLE madi_lounge_comments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "lounge_comments_all_blocked" ON madi_lounge_comments;
CREATE POLICY "lounge_comments_all_blocked" ON madi_lounge_comments
  FOR ALL USING (false);

-- ─────────────────────────────────────────────────────────────
-- 10. madi_activities — 활동 기록
-- ─────────────────────────────────────────────────────────────
ALTER TABLE madi_activities ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "activities_all_blocked" ON madi_activities;
CREATE POLICY "activities_all_blocked" ON madi_activities
  FOR ALL USING (false);

-- ─────────────────────────────────────────────────────────────
-- 11. madi_error_logs — 에러 로그
-- ─────────────────────────────────────────────────────────────
ALTER TABLE madi_error_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "error_logs_all_blocked" ON madi_error_logs;
CREATE POLICY "error_logs_all_blocked" ON madi_error_logs
  FOR ALL USING (false);

-- ─────────────────────────────────────────────────────────────
-- 완료 확인 쿼리
-- SELECT tablename, policyname, cmd, qual
-- FROM pg_policies
-- WHERE schemaname = 'public'
--   AND tablename IN (
--     'madi_children','madi_sessions','madi_schedules',
--     'madi_assessments','madi_iep_history','madi_notices',
--     'madi_global_notices','madi_lounge_posts','madi_lounge_comments',
--     'madi_activities','madi_error_logs'
--   )
-- ORDER BY tablename;
-- ─────────────────────────────────────────────────────────────
