-- ══════════════════════════════════════════════════════════════════════
-- TOTP replay 방지 — 마지막으로 성공한 TOTP step 저장
-- 2026-05-30 외부 보안 진단 후속 (브루트포스 rate-limit + replay 방지)
-- ══════════════════════════════════════════════════════════════════════

ALTER TABLE madi_users
  ADD COLUMN IF NOT EXISTS totp_last_step bigint;   -- 마지막 검증 성공 step (Math.floor(epoch_ms/30000) ± offset). NULL = 미사용

COMMENT ON COLUMN madi_users.totp_last_step IS
  'replay 방지용. 마지막으로 검증에 성공한 TOTP step. 이 값 이하 step 의 코드는 재사용으로 간주해 거부.';
