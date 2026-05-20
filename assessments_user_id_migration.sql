-- ══════════════════════════════════════════════════════════════════════
-- madi_assessments.user_id 컬럼 추가 + 백필 (Second-pass QA M-C)
-- 목적: 평가 작성자 추적·필터링용 별도 컬럼 (현재는 data JSONB 안에만 묻혀 있음)
-- ══════════════════════════════════════════════════════════════════════

ALTER TABLE madi_assessments
  ADD COLUMN IF NOT EXISTS user_id text;

-- 기존 행에서 data->>'user_id' 가 있으면 그것으로 백필
UPDATE madi_assessments
SET    user_id = data->>'user_id'
WHERE  user_id IS NULL
  AND  data->>'user_id' IS NOT NULL;

-- 확인 쿼리 (선택)
-- SELECT COUNT(*) FILTER (WHERE user_id IS NULL) AS null_user_id, COUNT(*) AS total FROM madi_assessments;
