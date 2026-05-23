-- ══════════════════════════════════════════════════════════════════════
-- TOTP 2FA (SEC6) — superadmin/admin 권한자 다중 인증
-- 2026-05-24 외부 보안 진단 후속
-- ══════════════════════════════════════════════════════════════════════

ALTER TABLE madi_users
  ADD COLUMN IF NOT EXISTS totp_secret   text,      -- base32-encoded shared secret (NULL = 미설정)
  ADD COLUMN IF NOT EXISTS totp_enabled  boolean   NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS totp_enrolled_at timestamptz;

COMMENT ON COLUMN madi_users.totp_secret IS
  'TOTP shared secret (base32). null=미설정. 설정 후엔 노출 금지 — API select 에서 제외 처리.';
COMMENT ON COLUMN madi_users.totp_enabled IS
  '2FA 활성화 여부. true 시 로그인에 6자리 코드 추가 요구.';
COMMENT ON COLUMN madi_users.totp_enrolled_at IS
  '2FA 등록 시각. 감사·운영 용도.';

-- 강한 권고: superadmin/admin 은 2FA 필수 (CHECK 제약은 마이그레이션 부담이라 권고문만)
-- 운영 정책: 30일 grace period 후 totp_enabled=false 인 admin 계정 강제 잠금 검토
