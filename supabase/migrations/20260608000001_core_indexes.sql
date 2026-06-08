-- ============================================================
-- MADI — 코어 임상 테이블 인덱스 (성능) [HIGH]
-- db push 적용본. CONCURRENTLY 제거(트랜잭션 호환) — 코어 테이블 소규모(≤~1700행)라
-- ACCESS EXCLUSIVE 잠금이 순간. 표현식은 라이브 쿼리(api/index.ts·madi-app.js)와 동형.
-- 모두 IF NOT EXISTS — 멱등·비파괴. 상세 근거: supabase/add_core_indexes.sql 참조.
-- ============================================================

-- 1. madi_children — 센터별 아동 로드
CREATE INDEX IF NOT EXISTS idx_children_center
  ON madi_children (center_id);

-- 2. madi_sessions — 교사 로드(center+date), 학부모 격리(center+childId)
CREATE INDEX IF NOT EXISTS idx_sessions_center_date
  ON madi_sessions (center_id, (data->>'date'));
CREATE INDEX IF NOT EXISTS idx_sessions_center_child
  ON madi_sessions (center_id, (data->>'childId'));

-- 3. madi_schedules — 행 최다(1700+)
CREATE INDEX IF NOT EXISTS idx_schedules_center_date
  ON madi_schedules (center_id, (data->>'date'));
CREATE INDEX IF NOT EXISTS idx_schedules_center_child
  ON madi_schedules (center_id, (data->>'childId'));

-- 4. madi_assessments
CREATE INDEX IF NOT EXISTS idx_assessments_center_date
  ON madi_assessments (center_id, (data->>'date'));
CREATE INDEX IF NOT EXISTS idx_assessments_center_child
  ON madi_assessments (center_id, (data->>'childId'));

-- 5. madi_iep_history
CREATE INDEX IF NOT EXISTS idx_iep_history_center_date
  ON madi_iep_history (center_id, (data->>'date'));
CREATE INDEX IF NOT EXISTS idx_iep_history_center_child
  ON madi_iep_history (center_id, (data->>'childId'));
