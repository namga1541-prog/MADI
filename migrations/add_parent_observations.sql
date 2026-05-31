-- ──────────────────────────────────────────────────────────────
-- 학부모 관찰기록 테이블
-- 학부모가 가정에서 관찰한 아동 행동을 선생님에게 전달하는 채널.
-- 선생님은 teacher_reply / replied_at / replied_by 로 답글 작성.
-- ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS madi_parent_observations (
  id              uuid         DEFAULT gen_random_uuid() PRIMARY KEY,
  parent_user_id  uuid         NOT NULL REFERENCES madi_users(id),
  child_id        text         NOT NULL,
  center_id       uuid         NOT NULL REFERENCES madi_centers(id),
  content         text         NOT NULL,
  category        text         DEFAULT 'general',
  teacher_reply   text,
  replied_at      timestamptz,
  replied_by      uuid         REFERENCES madi_users(id),
  created_at      timestamptz  DEFAULT now()
);

-- RLS 활성화
ALTER TABLE madi_parent_observations ENABLE ROW LEVEL SECURITY;

-- 학부모: 자신이 작성한 기록만 조회/삽입
CREATE POLICY "parent_own_observations_select"
  ON madi_parent_observations
  FOR SELECT
  USING (parent_user_id = auth.uid());

CREATE POLICY "parent_own_observations_insert"
  ON madi_parent_observations
  FOR INSERT
  WITH CHECK (parent_user_id = auth.uid());

-- 선생님/관리자: 같은 center_id 기록 조회 + 답글(UPDATE) 허용
CREATE POLICY "staff_center_observations_select"
  ON madi_parent_observations
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM madi_users u
      WHERE u.id = auth.uid()
        AND u.role IN ('admin','teacher','superadmin')
        AND u.center_id = madi_parent_observations.center_id
    )
  );

CREATE POLICY "staff_center_observations_update"
  ON madi_parent_observations
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM madi_users u
      WHERE u.id = auth.uid()
        AND u.role IN ('admin','teacher','superadmin')
        AND u.center_id = madi_parent_observations.center_id
    )
  );
