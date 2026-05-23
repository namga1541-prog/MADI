-- ══════════════════════════════════════════════════════════════════════
-- 세션 보안 강화 (SEC3 + SEC4)
-- 2026-05-24 외부 보안 진단 후속
--
-- 추가 컬럼:
--   1. session_revoked_at — 관리자가 강제 로그아웃시 (iat 비교로 거부)
--   2. failed_login_count  — 연속 실패 횟수
--   3. last_failed_at      — 마지막 실패 시각 (30분 윈도우 계산용)
--   4. locked_until        — 잠금 해제 예정 시각
-- ══════════════════════════════════════════════════════════════════════

ALTER TABLE madi_users
  ADD COLUMN IF NOT EXISTS session_revoked_at  timestamptz,
  ADD COLUMN IF NOT EXISTS failed_login_count  int         NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_failed_at      timestamptz,
  ADD COLUMN IF NOT EXISTS locked_until        timestamptz;

COMMENT ON COLUMN madi_users.session_revoked_at IS
  '관리자/사용자가 강제 로그아웃한 시각. JWT iat < session_revoked_at 이면 거부됨.';
COMMENT ON COLUMN madi_users.failed_login_count IS
  '연속 로그인 실패 횟수. 5회 도달 시 locked_until 설정. 성공 시 0 리셋.';
COMMENT ON COLUMN madi_users.last_failed_at IS
  '마지막 실패 시각. 30분 경과 후 자연 리셋 — 옛 실패가 잠금을 유발하지 않게.';
COMMENT ON COLUMN madi_users.locked_until IS
  '잠금 해제 예정 시각. 이 시각 전엔 로그인 거부 (HTTP 423).';

-- 잠금 상태 조회용 헬퍼 인덱스 (관리자가 잠긴 계정 목록 보기)
CREATE INDEX IF NOT EXISTS idx_madi_users_locked
  ON madi_users (locked_until)
  WHERE locked_until IS NOT NULL;
