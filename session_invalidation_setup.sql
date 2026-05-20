-- ══════════════════════════════════════════════════════════════════════
-- 세션 무효화 (비밀번호 변경 시 기존 토큰 거부)
-- 동작: madi_users.password_changed_at 보다 이전에 발급된 JWT(iat) 는 api 에서 거부
-- ══════════════════════════════════════════════════════════════════════

ALTER TABLE madi_users
  ADD COLUMN IF NOT EXISTS password_changed_at timestamptz NOT NULL DEFAULT now();

-- 기존 행은 마이그레이션 시점으로 셋업 — 이후 발급된 토큰만 유효
-- (현재 활성 사용자는 모두 재로그인 1회 필요)
UPDATE madi_users
SET    password_changed_at = now()
WHERE  password_changed_at IS NULL;

COMMENT ON COLUMN madi_users.password_changed_at IS 'JWT iat 검증용 — 이 시각 이전 발급 토큰은 api Edge Function 에서 거부됨';
