-- ══════════════════════════════════════════════════════════════════════
-- 학부모 데이터 격리 RLS 보강
-- 목적:
--   1) 학부모(role='parent') 가 자기 자녀의 데이터만 SELECT 하도록 제한
--   2) 학부모는 children/sessions/schedules/assessments/iep_history 에
--      INSERT/UPDATE/DELETE 불가
--   3) 라운지 게시판(lounge_posts/comments) 은 학부모 비대상
--   4) madi_parent_children 의 잘못된 'true' 정책 정리
-- 사전조건: madi_my_role(), madi_my_center_id() 함수 존재
-- 실행: Supabase SQL Editor 또는 supabase db query --linked --file <this>
-- ══════════════════════════════════════════════════════════════════════

-- ── 1. 헬퍼 함수 — 학부모의 자녀 ID 배열 ─────────────────────────────
CREATE OR REPLACE FUNCTION madi_my_child_ids()
RETURNS text[]
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(array_agg(child_id), ARRAY[]::text[])
  FROM   madi_parent_children
  WHERE  parent_user_id = auth.uid()::text
$$;

-- ── 2. madi_parent_children — 잘못된 'true' 정책 제거 ────────────────
-- (한국어 이름 정책이 SELECT qual=true 로 열려 있어 매핑 전체 노출 중)
DROP POLICY IF EXISTS "학부모-아동 연결 조회"     ON madi_parent_children;
DROP POLICY IF EXISTS "학부모-아동 연결 생성"     ON madi_parent_children;

-- ── 3. madi_children — 학부모는 본인 자녀만 SELECT ───────────────────
DROP POLICY IF EXISTS "madi_children_select" ON madi_children;
CREATE POLICY "madi_children_select" ON madi_children FOR SELECT
USING (
  madi_my_role() = 'superadmin'
  OR (madi_my_role() = ANY(ARRAY['admin','teacher']) AND center_id = madi_my_center_id())
  OR (madi_my_role() = 'parent' AND id::text = ANY(madi_my_child_ids()))
);

DROP POLICY IF EXISTS "madi_children_update" ON madi_children;
CREATE POLICY "madi_children_update" ON madi_children FOR UPDATE
USING (
  madi_my_role() = 'superadmin'
  OR (madi_my_role() = ANY(ARRAY['admin','teacher']) AND center_id = madi_my_center_id())
);

DROP POLICY IF EXISTS "madi_children_delete" ON madi_children;
CREATE POLICY "madi_children_delete" ON madi_children FOR DELETE
USING (
  madi_my_role() = 'superadmin'
  OR (madi_my_role() = ANY(ARRAY['admin','teacher']) AND center_id = madi_my_center_id())
);

-- ── 4. madi_sessions — data->>'childId' 로 학부모 격리 ───────────────
DROP POLICY IF EXISTS "madi_sessions_select" ON madi_sessions;
CREATE POLICY "madi_sessions_select" ON madi_sessions FOR SELECT
USING (
  madi_my_role() = 'superadmin'
  OR (madi_my_role() = ANY(ARRAY['admin','teacher']) AND center_id = madi_my_center_id())
  OR (madi_my_role() = 'parent' AND COALESCE(data->>'childId', data->>'child_id') = ANY(madi_my_child_ids()))
);

DROP POLICY IF EXISTS "madi_sessions_update" ON madi_sessions;
CREATE POLICY "madi_sessions_update" ON madi_sessions FOR UPDATE
USING (
  madi_my_role() = 'superadmin'
  OR (madi_my_role() = ANY(ARRAY['admin','teacher']) AND center_id = madi_my_center_id())
);

DROP POLICY IF EXISTS "madi_sessions_delete" ON madi_sessions;
CREATE POLICY "madi_sessions_delete" ON madi_sessions FOR DELETE
USING (
  madi_my_role() = 'superadmin'
  OR (madi_my_role() = ANY(ARRAY['admin','teacher']) AND center_id = madi_my_center_id())
);

-- ── 5. madi_schedules — child_id 컬럼으로 학부모 격리 ────────────────
DROP POLICY IF EXISTS "madi_schedules_select" ON madi_schedules;
CREATE POLICY "madi_schedules_select" ON madi_schedules FOR SELECT
USING (
  madi_my_role() = 'superadmin'
  OR (madi_my_role() = ANY(ARRAY['admin','teacher']) AND center_id = madi_my_center_id())
  OR (madi_my_role() = 'parent' AND child_id::text = ANY(madi_my_child_ids()))
);

DROP POLICY IF EXISTS "madi_schedules_update" ON madi_schedules;
CREATE POLICY "madi_schedules_update" ON madi_schedules FOR UPDATE
USING (
  madi_my_role() = 'superadmin'
  OR (madi_my_role() = ANY(ARRAY['admin','teacher']) AND center_id = madi_my_center_id())
);

DROP POLICY IF EXISTS "madi_schedules_delete" ON madi_schedules;
CREATE POLICY "madi_schedules_delete" ON madi_schedules FOR DELETE
USING (
  madi_my_role() = 'superadmin'
  OR (madi_my_role() = ANY(ARRAY['admin','teacher']) AND center_id = madi_my_center_id())
);

-- ── 6. madi_assessments — 학부모 자녀만 ──────────────────────────────
DROP POLICY IF EXISTS "madi_assessments_select" ON madi_assessments;
CREATE POLICY "madi_assessments_select" ON madi_assessments FOR SELECT
USING (
  madi_my_role() = 'superadmin'
  OR (madi_my_role() = ANY(ARRAY['admin','teacher']) AND center_id = madi_my_center_id())
  OR (madi_my_role() = 'parent' AND COALESCE(data->>'childId', data->>'child_id') = ANY(madi_my_child_ids()))
);

DROP POLICY IF EXISTS "madi_assessments_update" ON madi_assessments;
CREATE POLICY "madi_assessments_update" ON madi_assessments FOR UPDATE
USING (
  madi_my_role() = 'superadmin'
  OR (madi_my_role() = ANY(ARRAY['admin','teacher']) AND center_id = madi_my_center_id())
);

DROP POLICY IF EXISTS "madi_assessments_delete" ON madi_assessments;
CREATE POLICY "madi_assessments_delete" ON madi_assessments FOR DELETE
USING (
  madi_my_role() = 'superadmin'
  OR (madi_my_role() = ANY(ARRAY['admin','teacher']) AND center_id = madi_my_center_id())
);

-- ── 7. madi_iep_history — 학부모 자녀만 ─────────────────────────────
DROP POLICY IF EXISTS "madi_iep_history_select" ON madi_iep_history;
CREATE POLICY "madi_iep_history_select" ON madi_iep_history FOR SELECT
USING (
  madi_my_role() = 'superadmin'
  OR (madi_my_role() = ANY(ARRAY['admin','teacher']) AND center_id = madi_my_center_id())
  OR (madi_my_role() = 'parent' AND COALESCE(data->>'childId', data->>'child_id') = ANY(madi_my_child_ids()))
);

DROP POLICY IF EXISTS "madi_iep_history_update" ON madi_iep_history;
CREATE POLICY "madi_iep_history_update" ON madi_iep_history FOR UPDATE
USING (
  madi_my_role() = 'superadmin'
  OR (madi_my_role() = ANY(ARRAY['admin','teacher']) AND center_id = madi_my_center_id())
);

DROP POLICY IF EXISTS "madi_iep_history_delete" ON madi_iep_history;
CREATE POLICY "madi_iep_history_delete" ON madi_iep_history FOR DELETE
USING (
  madi_my_role() = 'superadmin'
  OR (madi_my_role() = ANY(ARRAY['admin','teacher']) AND center_id = madi_my_center_id())
);

-- ── 8. madi_lounge_posts / madi_lounge_comments — 학부모 SELECT 차단 ─
DROP POLICY IF EXISTS "madi_lounge_posts_select" ON madi_lounge_posts;
CREATE POLICY "madi_lounge_posts_select" ON madi_lounge_posts FOR SELECT
USING (
  madi_my_role() = 'superadmin'
  OR (madi_my_role() = ANY(ARRAY['admin','teacher']) AND center_id = madi_my_center_id())
);

DROP POLICY IF EXISTS "madi_lounge_comments_select" ON madi_lounge_comments;
CREATE POLICY "madi_lounge_comments_select" ON madi_lounge_comments FOR SELECT
USING (
  madi_my_role() = 'superadmin'
  OR (madi_my_role() = ANY(ARRAY['admin','teacher'])
      AND EXISTS (
        SELECT 1 FROM madi_lounge_posts p
        WHERE  p.id = madi_lounge_comments.post_id
          AND  p.center_id = madi_my_center_id()
      ))
);

-- ── 9. madi_users — 학부모는 본인 정보만 SELECT (선생님 이름 표시용) ──
-- madi_users 에 SELECT 정책이 아예 없어 일반 인증 사용자도 anon key 로 접근 불가.
-- 현재는 PostgREST 가 자체적으로 차단. 학부모 자녀 일정에서 선생님 이름이 필요하면
-- 별도 RPC 또는 sessions.data 안의 teacher 필드를 사용. 추가 정책은 두지 않음.
-- (선택) 본인 정보 조회용:
DROP POLICY IF EXISTS "madi_users_select_self" ON madi_users;
CREATE POLICY "madi_users_select_self" ON madi_users FOR SELECT
USING (id = auth.uid());

-- ── 10. 확인 쿼리 (선택) ───────────────────────────────────────────────
-- SELECT proname FROM pg_proc WHERE proname='madi_my_child_ids';
-- SELECT tablename, policyname, cmd, qual FROM pg_policies
-- WHERE schemaname='public'
--   AND tablename IN ('madi_children','madi_sessions','madi_schedules','madi_assessments','madi_iep_history','madi_lounge_posts','madi_lounge_comments','madi_parent_children')
-- ORDER BY tablename, cmd, policyname;
