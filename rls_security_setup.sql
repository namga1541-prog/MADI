-- ═══════════════════════════════════════════════════════════════════
-- 마디 앱 — RLS 보안 강화 + 스키마 보완
-- 실행 위치: Supabase Dashboard > SQL Editor
--
-- 주의: auth.uid() 가 올바르게 동작하려면
--       /api Edge Function 이 사용자 JWT 를 그대로 Supabase 클라이언트에
--       전달해야 합니다 (createClient with user bearer token).
--       service_role key 로만 실행하면 아래 RLS 는 우회됩니다.
-- ═══════════════════════════════════════════════════════════════════


-- ───────────────────────────────────────────────────────────────────
-- 0. 스키마 보완
--    madi_lounge_comments 에 author_id 컬럼 추가 (없으면)
--    madi_lounge_posts 의 author_id 는 자료실 기능에서 이미 추가됨
-- ───────────────────────────────────────────────────────────────────
ALTER TABLE madi_lounge_comments ADD COLUMN IF NOT EXISTS author_id text;


-- ───────────────────────────────────────────────────────────────────
-- 1. 헬퍼 함수
--    SECURITY DEFINER: madi_users 에 RLS 를 추가해도 재귀 없이 작동
-- ───────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION madi_my_center_id()
RETURNS text LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT center_id FROM madi_users WHERE id = auth.uid()
$$;

CREATE OR REPLACE FUNCTION madi_my_role()
RETURNS text LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT role FROM madi_users WHERE id = auth.uid()
$$;


-- ───────────────────────────────────────────────────────────────────
-- 2. madi_lounge_posts
--    · SELECT : 같은 센터 또는 슈퍼관리자
--    · INSERT : 본인 author_id + 본인 center_id
--    · DELETE : 본인 글 또는 슈퍼관리자
--    (UPDATE 는 현재 앱에서 미사용 → 허용하지 않음)
-- ───────────────────────────────────────────────────────────────────
ALTER TABLE madi_lounge_posts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "madi_lounge_posts_select" ON madi_lounge_posts;
CREATE POLICY "madi_lounge_posts_select" ON madi_lounge_posts FOR SELECT
USING (
  madi_my_role() = 'superadmin'
  OR center_id = madi_my_center_id()
);

DROP POLICY IF EXISTS "madi_lounge_posts_insert" ON madi_lounge_posts;
CREATE POLICY "madi_lounge_posts_insert" ON madi_lounge_posts FOR INSERT
WITH CHECK (
  auth.uid() IS NOT NULL
  AND (author_id IS NULL OR author_id = auth.uid()::text)
  AND (center_id = madi_my_center_id() OR madi_my_role() = 'superadmin')
);

DROP POLICY IF EXISTS "madi_lounge_posts_delete" ON madi_lounge_posts;
CREATE POLICY "madi_lounge_posts_delete" ON madi_lounge_posts FOR DELETE
USING (
  madi_my_role() = 'superadmin'
  OR (author_id IS NOT NULL AND author_id = auth.uid()::text)
  OR (author_id IS NULL AND center_id = madi_my_center_id()
      AND madi_my_role() IN ('admin', 'superadmin'))
);


-- ───────────────────────────────────────────────────────────────────
-- 3. madi_lounge_comments
--    · SELECT : 부모 게시글이 조회 가능한 경우
--    · INSERT : 인증된 사용자 + 본인 author_id
--    · DELETE : 본인 댓글 또는 슈퍼관리자/관리자
-- ───────────────────────────────────────────────────────────────────
ALTER TABLE madi_lounge_comments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "madi_lounge_comments_select" ON madi_lounge_comments;
CREATE POLICY "madi_lounge_comments_select" ON madi_lounge_comments FOR SELECT
USING (
  madi_my_role() = 'superadmin'
  OR EXISTS (
    SELECT 1 FROM madi_lounge_posts p
    WHERE p.id = post_id
      AND (madi_my_role() = 'superadmin' OR p.center_id = madi_my_center_id())
  )
);

DROP POLICY IF EXISTS "madi_lounge_comments_insert" ON madi_lounge_comments;
CREATE POLICY "madi_lounge_comments_insert" ON madi_lounge_comments FOR INSERT
WITH CHECK (
  auth.uid() IS NOT NULL
  AND (author_id IS NULL OR author_id = auth.uid()::text)
);

DROP POLICY IF EXISTS "madi_lounge_comments_delete" ON madi_lounge_comments;
CREATE POLICY "madi_lounge_comments_delete" ON madi_lounge_comments FOR DELETE
USING (
  madi_my_role() = 'superadmin'
  OR (author_id IS NOT NULL AND author_id = auth.uid()::text)
  OR (author_id IS NULL AND madi_my_role() IN ('admin', 'superadmin'))
);


-- ───────────────────────────────────────────────────────────────────
-- 4. 핵심 데이터 테이블 — 센터 격리
--    center_id 컬럼이 있는 모든 주요 테이블에 동일한 패턴 적용
--    슈퍼관리자만 전체 조회 가능, 나머지는 자기 센터만
-- ───────────────────────────────────────────────────────────────────

-- madi_children
ALTER TABLE madi_children ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "madi_children_select" ON madi_children;
CREATE POLICY "madi_children_select" ON madi_children FOR SELECT
USING (madi_my_role() = 'superadmin' OR center_id = madi_my_center_id());

DROP POLICY IF EXISTS "madi_children_insert" ON madi_children;
CREATE POLICY "madi_children_insert" ON madi_children FOR INSERT
WITH CHECK (madi_my_role() = 'superadmin' OR center_id = madi_my_center_id());

DROP POLICY IF EXISTS "madi_children_update" ON madi_children;
CREATE POLICY "madi_children_update" ON madi_children FOR UPDATE
USING (madi_my_role() = 'superadmin' OR center_id = madi_my_center_id());

DROP POLICY IF EXISTS "madi_children_delete" ON madi_children;
CREATE POLICY "madi_children_delete" ON madi_children FOR DELETE
USING (madi_my_role() = 'superadmin' OR center_id = madi_my_center_id());

-- madi_sessions
ALTER TABLE madi_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "madi_sessions_select" ON madi_sessions;
CREATE POLICY "madi_sessions_select" ON madi_sessions FOR SELECT
USING (madi_my_role() = 'superadmin' OR center_id = madi_my_center_id());

DROP POLICY IF EXISTS "madi_sessions_insert" ON madi_sessions;
CREATE POLICY "madi_sessions_insert" ON madi_sessions FOR INSERT
WITH CHECK (madi_my_role() = 'superadmin' OR center_id = madi_my_center_id());

DROP POLICY IF EXISTS "madi_sessions_update" ON madi_sessions;
CREATE POLICY "madi_sessions_update" ON madi_sessions FOR UPDATE
USING (madi_my_role() = 'superadmin' OR center_id = madi_my_center_id());

DROP POLICY IF EXISTS "madi_sessions_delete" ON madi_sessions;
CREATE POLICY "madi_sessions_delete" ON madi_sessions FOR DELETE
USING (madi_my_role() = 'superadmin' OR center_id = madi_my_center_id());

-- madi_schedules
ALTER TABLE madi_schedules ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "madi_schedules_select" ON madi_schedules;
CREATE POLICY "madi_schedules_select" ON madi_schedules FOR SELECT
USING (madi_my_role() = 'superadmin' OR center_id = madi_my_center_id());

DROP POLICY IF EXISTS "madi_schedules_insert" ON madi_schedules;
CREATE POLICY "madi_schedules_insert" ON madi_schedules FOR INSERT
WITH CHECK (madi_my_role() = 'superadmin' OR center_id = madi_my_center_id());

DROP POLICY IF EXISTS "madi_schedules_update" ON madi_schedules;
CREATE POLICY "madi_schedules_update" ON madi_schedules FOR UPDATE
USING (madi_my_role() = 'superadmin' OR center_id = madi_my_center_id());

DROP POLICY IF EXISTS "madi_schedules_delete" ON madi_schedules;
CREATE POLICY "madi_schedules_delete" ON madi_schedules FOR DELETE
USING (madi_my_role() = 'superadmin' OR center_id = madi_my_center_id());

-- madi_assessments
ALTER TABLE madi_assessments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "madi_assessments_select" ON madi_assessments;
CREATE POLICY "madi_assessments_select" ON madi_assessments FOR SELECT
USING (madi_my_role() = 'superadmin' OR center_id = madi_my_center_id());

DROP POLICY IF EXISTS "madi_assessments_insert" ON madi_assessments;
CREATE POLICY "madi_assessments_insert" ON madi_assessments FOR INSERT
WITH CHECK (madi_my_role() = 'superadmin' OR center_id = madi_my_center_id());

DROP POLICY IF EXISTS "madi_assessments_update" ON madi_assessments;
CREATE POLICY "madi_assessments_update" ON madi_assessments FOR UPDATE
USING (madi_my_role() = 'superadmin' OR center_id = madi_my_center_id());

DROP POLICY IF EXISTS "madi_assessments_delete" ON madi_assessments;
CREATE POLICY "madi_assessments_delete" ON madi_assessments FOR DELETE
USING (madi_my_role() = 'superadmin' OR center_id = madi_my_center_id());

-- madi_iep_history
ALTER TABLE madi_iep_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "madi_iep_history_select" ON madi_iep_history;
CREATE POLICY "madi_iep_history_select" ON madi_iep_history FOR SELECT
USING (madi_my_role() = 'superadmin' OR center_id = madi_my_center_id());

DROP POLICY IF EXISTS "madi_iep_history_insert" ON madi_iep_history;
CREATE POLICY "madi_iep_history_insert" ON madi_iep_history FOR INSERT
WITH CHECK (madi_my_role() = 'superadmin' OR center_id = madi_my_center_id());

DROP POLICY IF EXISTS "madi_iep_history_update" ON madi_iep_history;
CREATE POLICY "madi_iep_history_update" ON madi_iep_history FOR UPDATE
USING (madi_my_role() = 'superadmin' OR center_id = madi_my_center_id());

DROP POLICY IF EXISTS "madi_iep_history_delete" ON madi_iep_history;
CREATE POLICY "madi_iep_history_delete" ON madi_iep_history FOR DELETE
USING (madi_my_role() = 'superadmin' OR center_id = madi_my_center_id());

-- madi_activities
ALTER TABLE madi_activities ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "madi_activities_select" ON madi_activities;
CREATE POLICY "madi_activities_select" ON madi_activities FOR SELECT
USING (madi_my_role() = 'superadmin' OR center_id = madi_my_center_id());

DROP POLICY IF EXISTS "madi_activities_insert" ON madi_activities;
CREATE POLICY "madi_activities_insert" ON madi_activities FOR INSERT
WITH CHECK (madi_my_role() = 'superadmin' OR center_id = madi_my_center_id());

DROP POLICY IF EXISTS "madi_activities_update" ON madi_activities;
CREATE POLICY "madi_activities_update" ON madi_activities FOR UPDATE
USING (madi_my_role() = 'superadmin' OR center_id = madi_my_center_id());

DROP POLICY IF EXISTS "madi_activities_delete" ON madi_activities;
CREATE POLICY "madi_activities_delete" ON madi_activities FOR DELETE
USING (madi_my_role() = 'superadmin' OR center_id = madi_my_center_id());


-- ───────────────────────────────────────────────────────────────────
-- 5. madi_parent_children — 학부모는 본인 자녀 정보만 조회
-- ───────────────────────────────────────────────────────────────────
ALTER TABLE madi_parent_children ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "madi_parent_children_select" ON madi_parent_children;
CREATE POLICY "madi_parent_children_select" ON madi_parent_children FOR SELECT
USING (
  madi_my_role() = 'superadmin'
  OR center_id = madi_my_center_id()
  OR parent_user_id = auth.uid()
);

DROP POLICY IF EXISTS "madi_parent_children_insert" ON madi_parent_children;
CREATE POLICY "madi_parent_children_insert" ON madi_parent_children FOR INSERT
WITH CHECK (
  madi_my_role() IN ('superadmin', 'admin')
  OR parent_user_id = auth.uid()
);

DROP POLICY IF EXISTS "madi_parent_children_delete" ON madi_parent_children;
CREATE POLICY "madi_parent_children_delete" ON madi_parent_children FOR DELETE
USING (
  madi_my_role() IN ('superadmin', 'admin')
);


-- ───────────────────────────────────────────────────────────────────
-- 6. 검증 쿼리 (실행 후 확인용)
-- ───────────────────────────────────────────────────────────────────
-- 활성화된 RLS 테이블 확인:
-- SELECT tablename, rowsecurity FROM pg_tables
-- WHERE schemaname = 'public' AND tablename LIKE 'madi_%';

-- 정책 목록 확인:
-- SELECT tablename, policyname, cmd
-- FROM pg_policies WHERE schemaname = 'public' AND tablename LIKE 'madi_%'
-- ORDER BY tablename, cmd;
