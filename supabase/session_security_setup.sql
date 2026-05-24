-- ============================================================
-- 세션 보안 컬럼 추가 — madi_users 테이블
-- ============================================================
-- SEC3: session_revoked_at — 강제 로그아웃 (비밀번호 변경 시 기존 세션 무효화)
-- SEC4: failed_login_count, last_failed_at, locked_until — 계정 잠금 (5회 실패/30분)
-- SEC6: totp_secret, totp_enabled, totp_enrolled_at — TOTP 2단계 인증
-- 멱등: IF NOT EXISTS 패턴, 재실행 안전
-- 실행: Supabase Dashboard → SQL Editor → 전체 붙여넣기 → Run
-- ============================================================

-- SEC3: 강제 로그아웃용 타임스탬프
ALTER TABLE madi_users
  ADD COLUMN IF NOT EXISTS session_revoked_at TIMESTAMPTZ;

-- SEC4: 계정 잠금
ALTER TABLE madi_users
  ADD COLUMN IF NOT EXISTS failed_login_count INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_failed_at     TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS locked_until       TIMESTAMPTZ;

-- SEC6: TOTP 2단계 인증
ALTER TABLE madi_users
  ADD COLUMN IF NOT EXISTS totp_secret      TEXT,
  ADD COLUMN IF NOT EXISTS totp_enabled     BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS totp_enrolled_at TIMESTAMPTZ;

-- 기존 행 NULL 방어 백필
UPDATE madi_users
SET    failed_login_count = 0
WHERE  failed_login_count IS NULL;

UPDATE madi_users
SET    totp_enabled = false
WHERE  totp_enabled IS NULL;

-- 검증 쿼리
SELECT id, username, role,
       session_revoked_at,
       failed_login_count, locked_until,
       totp_enabled
FROM   madi_users
LIMIT  5;
