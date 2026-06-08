-- ============================================================
-- MADI — 죽은 RLS 정책 정리 (문서화 + 선택적 DROP)
-- 최초 작성: 2026-06-08
-- 분류: [MED] — 동작 불변(정리·문서화 위주)
--
-- 배경 (2026-06 RBAC/DB 감사 결론)
--   · /api Edge Function 이 ★service_role★ 로 PostgREST 를 호출 → RLS 우회.
--     클라이언트엔 anon-key 직접접근·rpc·Realtime 경로가 없다.
--     따라서 ★인가의 SSOT 는 supabase/functions/api/index.ts★ 이다.
--   · 자체 JWT 인증이라, 설령 RLS 가 평가되는 경로라도 auth.uid() 는
--     NULL 이다(Supabase Auth 가 발급한 JWT 가 아니므로). 즉
--     auth.uid()/madi_my_role()/madi_my_center_id()/madi_my_child_ids()
--     에 의존하는 모든 role 기반 정책은 ★실효 없는 죽은 정책★이다.
--
-- 이 파일이 ★유지(미삭제)★ 하는 것 (의도된 방어선 — 건드리지 말 것)
--   · rls_core_tables.sql 의 `*_all_blocked` (FOR ALL USING(false))
--     rls_policies.sql 의 `*_blocked` 류 차단 정책
--       → anon-key 우발 노출 대비 defense-in-depth. service_role 우회와
--         무관하게 "혹시 anon 으로 새면 전면 차단" 보장. ★유지★
--   · storage_policies_tighten.sql → 실효(스토리지 직접 접근 차단). ★유지★
--
-- 이 파일이 ★정리(DROP)★ 하는 것
--   · rls_security_setup.sql / parent_isolation_rls.sql 가 만든
--     role 기반(permissive) 정책들. auth.uid() NULL 이라 항상 거짓 →
--     아무에게도 권한을 주지 못하는 죽은 permissive 정책.
--   · 죽은 permissive 정책은 ★보안을 약화시키진 않으나★(USING(false)
--     차단이 그대로 남음), 감사 시 "센터 격리가 RLS 로 되는 듯한" 착시를
--     주어 오탐·오판을 유발하므로 제거해 노이즈를 없앤다.
--
-- ⚠️ 동작 불변 보증
--   · service_role 경로(=앱 전체)는 RLS 자체를 우회하므로, 죽은 정책을
--     지우든 두든 앱 동작은 ★완전히 동일★하다.
--   · USING(false) 차단 정책은 손대지 않으므로 anon 방어선도 불변.
--
-- ⚠️ 미래 전환 주의
--   · 언젠가 Supabase Auth(진짜 auth.uid())로 전환하거나, 사용자 JWT 를
--     PostgREST 에 그대로 전달하는 구조로 바꾸면, 아래에서 지운 role 기반
--     정책이 ★다시 필요★해진다. 그때는 rls_security_setup.sql /
--     parent_isolation_rls.sql 를 재적용하고 USING(false) 차단을 걷어내며
--     이 파일의 DROP 을 ★실행하지 말 것★.
--
-- ⚠️ 실행은 선택 사항(비파괴적이지만 권장)
--   · 보수적으로 가려면 이 파일을 ★실행하지 않고 문서로만 두어도★ 된다
--     (죽은 정책은 무해). 정리를 원하면 아래 DROP 블록을 Run.
-- ============================================================


-- ============================================================
-- [참조표] 테이블별 정책 상태 (감사용 SSOT)
-- ------------------------------------------------------------
--  상태 범례
--    DEAD  = role/auth.uid() 의존 → 자체JWT 경로서 항상 거짓, 무효 (DROP 대상)
--    KEEP  = USING(false) 전면 차단 → anon 방어선, 유지
--    KEEP* = 의도적 공개/실효 정책 → 유지
--
--  테이블                | 출처 SQL                  | 정책명                              | 상태
--  ----------------------|---------------------------|-------------------------------------|------
--  madi_children         | rls_security_setup        | madi_children_select/insert/update/delete | DEAD
--                        | parent_isolation_rls      | madi_children_select/update/delete  | DEAD
--                        | rls_core_tables           | children_all_blocked                | KEEP
--  madi_sessions         | rls_security_setup        | madi_sessions_*                     | DEAD
--                        | parent_isolation_rls      | madi_sessions_select/update/delete  | DEAD
--                        | rls_core_tables           | sessions_all_blocked                | KEEP
--  madi_schedules        | rls_security_setup        | madi_schedules_*                    | DEAD
--                        | parent_isolation_rls      | madi_schedules_select/update/delete | DEAD
--                        | rls_core_tables           | schedules_all_blocked               | KEEP
--  madi_assessments      | rls_security_setup        | madi_assessments_*                  | DEAD
--                        | parent_isolation_rls      | madi_assessments_select/update/delete | DEAD
--                        | rls_core_tables           | assessments_all_blocked             | KEEP
--  madi_iep_history      | rls_security_setup        | madi_iep_history_*                   | DEAD
--                        | parent_isolation_rls      | madi_iep_history_select/update/delete | DEAD
--                        | rls_core_tables           | iep_history_all_blocked             | KEEP
--  madi_activities       | rls_security_setup        | madi_activities_*                   | DEAD
--                        | rls_core_tables           | activities_all_blocked              | KEEP
--  madi_lounge_posts     | rls_security_setup        | madi_lounge_posts_select/insert/delete | DEAD
--                        | parent_isolation_rls      | madi_lounge_posts_select            | DEAD
--                        | rls_core_tables           | lounge_posts_all_blocked            | KEEP
--  madi_lounge_comments  | rls_security_setup        | madi_lounge_comments_select/insert/delete | DEAD
--                        | parent_isolation_rls      | madi_lounge_comments_select         | DEAD
--                        | rls_core_tables           | lounge_comments_all_blocked         | KEEP
--  madi_notices          | rls_security_setup        | madi_notices_*                      | DEAD
--                        | rls_core_tables           | notices_all_blocked                 | KEEP
--  madi_global_notices   | rls_security_setup        | madi_global_notices_*               | DEAD
--                        | rls_core_tables           | global_notices_all_blocked          | KEEP
--  madi_error_logs       | rls_security_setup        | madi_error_logs_*                   | DEAD
--                        | rls_core_tables           | error_logs_all_blocked              | KEEP
--  madi_parent_children  | rls_security_setup        | madi_parent_children_select/insert/delete | DEAD
--  madi_users            | rls_security_setup        | madi_users_select/insert/update/delete | DEAD
--                        | parent_isolation_rls      | madi_users_select_self              | DEAD
--                        | rls_policies (1-B)        | users_select_blocked/users_write_blocked | KEEP
--  madi_centers          | rls_security_setup        | madi_centers_*                      | DEAD
--  madi_settings         | rls_security_setup        | madi_settings_*                     | DEAD
--  madi_notifications    | rls_security_setup        | madi_notifications_*                | DEAD
--  madi_licenses         | rls_security_setup        | madi_licenses_*                     | DEAD
--  (madi_users/centers/settings/notifications 등 1-B 대상 차단정책은 rls_policies.sql 의 KEEP)
--
--  헬퍼 함수: madi_my_role(), madi_my_center_id(), madi_my_child_ids()
--    → DEAD 정책이 모두 사라지면 미참조가 되지만, 미래 재전환 대비로
--      ★함수는 삭제하지 않는다★ (무해, 재적용 시 필요).
-- ============================================================


-- ============================================================
-- [DROP 블록] 죽은 role 기반 permissive 정책 정리
-- ★ USING(false) 차단 정책(*_all_blocked / *_blocked)은 건드리지 않음 ★
-- 모두 DROP POLICY IF EXISTS — 멱등, 없는 정책이면 무시.
-- ============================================================

-- ── madi_children ───────────────────────────────────────────
DROP POLICY IF EXISTS "madi_children_select" ON madi_children;
DROP POLICY IF EXISTS "madi_children_insert" ON madi_children;
DROP POLICY IF EXISTS "madi_children_update" ON madi_children;
DROP POLICY IF EXISTS "madi_children_delete" ON madi_children;

-- ── madi_sessions ───────────────────────────────────────────
DROP POLICY IF EXISTS "madi_sessions_select" ON madi_sessions;
DROP POLICY IF EXISTS "madi_sessions_insert" ON madi_sessions;
DROP POLICY IF EXISTS "madi_sessions_update" ON madi_sessions;
DROP POLICY IF EXISTS "madi_sessions_delete" ON madi_sessions;

-- ── madi_schedules ──────────────────────────────────────────
DROP POLICY IF EXISTS "madi_schedules_select" ON madi_schedules;
DROP POLICY IF EXISTS "madi_schedules_insert" ON madi_schedules;
DROP POLICY IF EXISTS "madi_schedules_update" ON madi_schedules;
DROP POLICY IF EXISTS "madi_schedules_delete" ON madi_schedules;

-- ── madi_assessments ────────────────────────────────────────
DROP POLICY IF EXISTS "madi_assessments_select" ON madi_assessments;
DROP POLICY IF EXISTS "madi_assessments_insert" ON madi_assessments;
DROP POLICY IF EXISTS "madi_assessments_update" ON madi_assessments;
DROP POLICY IF EXISTS "madi_assessments_delete" ON madi_assessments;

-- ── madi_iep_history ────────────────────────────────────────
DROP POLICY IF EXISTS "madi_iep_history_select" ON madi_iep_history;
DROP POLICY IF EXISTS "madi_iep_history_insert" ON madi_iep_history;
DROP POLICY IF EXISTS "madi_iep_history_update" ON madi_iep_history;
DROP POLICY IF EXISTS "madi_iep_history_delete" ON madi_iep_history;

-- ── madi_activities ─────────────────────────────────────────
DROP POLICY IF EXISTS "madi_activities_select" ON madi_activities;
DROP POLICY IF EXISTS "madi_activities_insert" ON madi_activities;
DROP POLICY IF EXISTS "madi_activities_update" ON madi_activities;
DROP POLICY IF EXISTS "madi_activities_delete" ON madi_activities;

-- ── madi_lounge_posts ───────────────────────────────────────
DROP POLICY IF EXISTS "madi_lounge_posts_select" ON madi_lounge_posts;
DROP POLICY IF EXISTS "madi_lounge_posts_insert" ON madi_lounge_posts;
DROP POLICY IF EXISTS "madi_lounge_posts_delete" ON madi_lounge_posts;

-- ── madi_lounge_comments ────────────────────────────────────
DROP POLICY IF EXISTS "madi_lounge_comments_select" ON madi_lounge_comments;
DROP POLICY IF EXISTS "madi_lounge_comments_insert" ON madi_lounge_comments;
DROP POLICY IF EXISTS "madi_lounge_comments_delete" ON madi_lounge_comments;

-- ── madi_notices ────────────────────────────────────────────
DROP POLICY IF EXISTS "madi_notices_select" ON madi_notices;
DROP POLICY IF EXISTS "madi_notices_insert" ON madi_notices;
DROP POLICY IF EXISTS "madi_notices_update" ON madi_notices;
DROP POLICY IF EXISTS "madi_notices_delete" ON madi_notices;

-- ── madi_global_notices ─────────────────────────────────────
DROP POLICY IF EXISTS "madi_global_notices_select" ON madi_global_notices;
DROP POLICY IF EXISTS "madi_global_notices_insert" ON madi_global_notices;
DROP POLICY IF EXISTS "madi_global_notices_update" ON madi_global_notices;
DROP POLICY IF EXISTS "madi_global_notices_delete" ON madi_global_notices;

-- ── madi_error_logs ─────────────────────────────────────────
DROP POLICY IF EXISTS "madi_error_logs_select" ON madi_error_logs;
DROP POLICY IF EXISTS "madi_error_logs_insert" ON madi_error_logs;
DROP POLICY IF EXISTS "madi_error_logs_delete" ON madi_error_logs;

-- ── madi_parent_children ────────────────────────────────────
DROP POLICY IF EXISTS "madi_parent_children_select" ON madi_parent_children;
DROP POLICY IF EXISTS "madi_parent_children_insert" ON madi_parent_children;
DROP POLICY IF EXISTS "madi_parent_children_delete" ON madi_parent_children;
-- (참고) 과거 한국어명 'true' 정책은 parent_isolation_rls.sql 가 이미 DROP.

-- ── madi_users (role 기반 DEAD 만 — KEEP 차단정책은 미삭제) ──
DROP POLICY IF EXISTS "madi_users_select" ON madi_users;
DROP POLICY IF EXISTS "madi_users_insert" ON madi_users;
DROP POLICY IF EXISTS "madi_users_update" ON madi_users;
DROP POLICY IF EXISTS "madi_users_delete" ON madi_users;
DROP POLICY IF EXISTS "madi_users_select_self" ON madi_users;

-- ── madi_centers ────────────────────────────────────────────
DROP POLICY IF EXISTS "madi_centers_select" ON madi_centers;
DROP POLICY IF EXISTS "madi_centers_insert" ON madi_centers;
DROP POLICY IF EXISTS "madi_centers_update" ON madi_centers;
DROP POLICY IF EXISTS "madi_centers_delete" ON madi_centers;

-- ── madi_settings ───────────────────────────────────────────
DROP POLICY IF EXISTS "madi_settings_select" ON madi_settings;
DROP POLICY IF EXISTS "madi_settings_insert" ON madi_settings;
DROP POLICY IF EXISTS "madi_settings_update" ON madi_settings;
DROP POLICY IF EXISTS "madi_settings_delete" ON madi_settings;

-- ── madi_notifications ──────────────────────────────────────
DROP POLICY IF EXISTS "madi_notifications_select" ON madi_notifications;
DROP POLICY IF EXISTS "madi_notifications_insert" ON madi_notifications;
DROP POLICY IF EXISTS "madi_notifications_update" ON madi_notifications;
DROP POLICY IF EXISTS "madi_notifications_delete" ON madi_notifications;

-- ── madi_licenses (테이블 존재 시에만) ──────────────────────
DROP POLICY IF EXISTS "madi_licenses_select" ON madi_licenses;
DROP POLICY IF EXISTS "madi_licenses_insert" ON madi_licenses;
DROP POLICY IF EXISTS "madi_licenses_update" ON madi_licenses;
DROP POLICY IF EXISTS "madi_licenses_delete" ON madi_licenses;


-- ============================================================
-- 검증 (적용 후)
-- ------------------------------------------------------------
-- 1) 남은 정책이 모두 차단(qual=false) 또는 KEEP* 인지 확인:
--    SELECT tablename, policyname, cmd, qual
--    FROM pg_policies
--    WHERE schemaname='public' AND tablename LIKE 'madi_%'
--    ORDER BY tablename, policyname;
--    → role 기반(madi_my_role/auth.uid 가 qual 에 보이는) 정책이
--      더 이상 없어야 한다. *_all_blocked / *_blocked(qual=false)만 남으면 정상.
--
-- 2) RLS 활성화 상태는 불변(여전히 모두 true) — MIGRATIONS_RUNBOOK baseline 표 참조.
--
-- 3) 앱 동작 확인: service_role 경로라 변화 없어야 정상.
--    교사/관리자/학부모 각 1계정으로 로그인 후 데이터 로드 정상 확인.
-- ============================================================
