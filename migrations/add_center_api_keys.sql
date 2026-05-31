-- 센터별 API 키 분리 (현재 madi_settings는 전역 공유 — 센터별 격리 필요)
CREATE TABLE IF NOT EXISTS madi_center_settings (
  center_id uuid PRIMARY KEY REFERENCES madi_centers(id),
  anthropic_api_key text,
  updated_at timestamptz DEFAULT now(),
  updated_by uuid REFERENCES madi_users(id)
);
ALTER TABLE madi_center_settings ENABLE ROW LEVEL SECURITY;
-- 실행 후 기존 전역 키를 각 센터로 복사하려면:
-- INSERT INTO madi_center_settings(center_id, anthropic_api_key)
-- SELECT id,(SELECT value FROM madi_settings WHERE key='anthropic_api_key') FROM madi_centers
-- ON CONFLICT DO NOTHING;
