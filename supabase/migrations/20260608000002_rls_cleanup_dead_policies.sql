-- ============================================================
-- MADI — 죽은 RLS 정책 정리 [MED, 동작 불변]
-- db push 적용본. 자체 JWT(auth.uid()=NULL) + service_role 우회로 무효인
-- role 기반 permissive 정책만 DROP. USING(false) 차단·Storage 정책은 유지.
-- permissive 제거는 접근을 넓힐 수 없고 좁히기만 함(안전). 멱등(IF EXISTS).
-- 상세 참조표·근거: supabase/rls_cleanup_dead_policies.sql
-- ============================================================

-- madi_children
DROP POLICY IF EXISTS "madi_children_select" ON madi_children;
DROP POLICY IF EXISTS "madi_children_insert" ON madi_children;
DROP POLICY IF EXISTS "madi_children_update" ON madi_children;
DROP POLICY IF EXISTS "madi_children_delete" ON madi_children;

-- madi_sessions
DROP POLICY IF EXISTS "madi_sessions_select" ON madi_sessions;
DROP POLICY IF EXISTS "madi_sessions_insert" ON madi_sessions;
DROP POLICY IF EXISTS "madi_sessions_update" ON madi_sessions;
DROP POLICY IF EXISTS "madi_sessions_delete" ON madi_sessions;

-- madi_schedules
DROP POLICY IF EXISTS "madi_schedules_select" ON madi_schedules;
DROP POLICY IF EXISTS "madi_schedules_insert" ON madi_schedules;
DROP POLICY IF EXISTS "madi_schedules_update" ON madi_schedules;
DROP POLICY IF EXISTS "madi_schedules_delete" ON madi_schedules;

-- madi_assessments
DROP POLICY IF EXISTS "madi_assessments_select" ON madi_assessments;
DROP POLICY IF EXISTS "madi_assessments_insert" ON madi_assessments;
DROP POLICY IF EXISTS "madi_assessments_update" ON madi_assessments;
DROP POLICY IF EXISTS "madi_assessments_delete" ON madi_assessments;

-- madi_iep_history
DROP POLICY IF EXISTS "madi_iep_history_select" ON madi_iep_history;
DROP POLICY IF EXISTS "madi_iep_history_insert" ON madi_iep_history;
DROP POLICY IF EXISTS "madi_iep_history_update" ON madi_iep_history;
DROP POLICY IF EXISTS "madi_iep_history_delete" ON madi_iep_history;

-- madi_activities
DROP POLICY IF EXISTS "madi_activities_select" ON madi_activities;
DROP POLICY IF EXISTS "madi_activities_insert" ON madi_activities;
DROP POLICY IF EXISTS "madi_activities_update" ON madi_activities;
DROP POLICY IF EXISTS "madi_activities_delete" ON madi_activities;

-- madi_lounge_posts
DROP POLICY IF EXISTS "madi_lounge_posts_select" ON madi_lounge_posts;
DROP POLICY IF EXISTS "madi_lounge_posts_insert" ON madi_lounge_posts;
DROP POLICY IF EXISTS "madi_lounge_posts_delete" ON madi_lounge_posts;

-- madi_lounge_comments
DROP POLICY IF EXISTS "madi_lounge_comments_select" ON madi_lounge_comments;
DROP POLICY IF EXISTS "madi_lounge_comments_insert" ON madi_lounge_comments;
DROP POLICY IF EXISTS "madi_lounge_comments_delete" ON madi_lounge_comments;

-- madi_notices
DROP POLICY IF EXISTS "madi_notices_select" ON madi_notices;
DROP POLICY IF EXISTS "madi_notices_insert" ON madi_notices;
DROP POLICY IF EXISTS "madi_notices_update" ON madi_notices;
DROP POLICY IF EXISTS "madi_notices_delete" ON madi_notices;

-- madi_global_notices
DROP POLICY IF EXISTS "madi_global_notices_select" ON madi_global_notices;
DROP POLICY IF EXISTS "madi_global_notices_insert" ON madi_global_notices;
DROP POLICY IF EXISTS "madi_global_notices_update" ON madi_global_notices;
DROP POLICY IF EXISTS "madi_global_notices_delete" ON madi_global_notices;

-- madi_error_logs
DROP POLICY IF EXISTS "madi_error_logs_select" ON madi_error_logs;
DROP POLICY IF EXISTS "madi_error_logs_insert" ON madi_error_logs;
DROP POLICY IF EXISTS "madi_error_logs_delete" ON madi_error_logs;

-- madi_parent_children
DROP POLICY IF EXISTS "madi_parent_children_select" ON madi_parent_children;
DROP POLICY IF EXISTS "madi_parent_children_insert" ON madi_parent_children;
DROP POLICY IF EXISTS "madi_parent_children_delete" ON madi_parent_children;

-- madi_users (role 기반 DEAD 만 — KEEP 차단정책은 미삭제)
DROP POLICY IF EXISTS "madi_users_select" ON madi_users;
DROP POLICY IF EXISTS "madi_users_insert" ON madi_users;
DROP POLICY IF EXISTS "madi_users_update" ON madi_users;
DROP POLICY IF EXISTS "madi_users_delete" ON madi_users;
DROP POLICY IF EXISTS "madi_users_select_self" ON madi_users;

-- madi_centers
DROP POLICY IF EXISTS "madi_centers_select" ON madi_centers;
DROP POLICY IF EXISTS "madi_centers_insert" ON madi_centers;
DROP POLICY IF EXISTS "madi_centers_update" ON madi_centers;
DROP POLICY IF EXISTS "madi_centers_delete" ON madi_centers;

-- madi_settings
DROP POLICY IF EXISTS "madi_settings_select" ON madi_settings;
DROP POLICY IF EXISTS "madi_settings_insert" ON madi_settings;
DROP POLICY IF EXISTS "madi_settings_update" ON madi_settings;
DROP POLICY IF EXISTS "madi_settings_delete" ON madi_settings;

-- madi_notifications
DROP POLICY IF EXISTS "madi_notifications_select" ON madi_notifications;
DROP POLICY IF EXISTS "madi_notifications_insert" ON madi_notifications;
DROP POLICY IF EXISTS "madi_notifications_update" ON madi_notifications;
DROP POLICY IF EXISTS "madi_notifications_delete" ON madi_notifications;

-- madi_licenses (테이블 존재 시에만)
DROP POLICY IF EXISTS "madi_licenses_select" ON madi_licenses;
DROP POLICY IF EXISTS "madi_licenses_insert" ON madi_licenses;
DROP POLICY IF EXISTS "madi_licenses_update" ON madi_licenses;
DROP POLICY IF EXISTS "madi_licenses_delete" ON madi_licenses;
