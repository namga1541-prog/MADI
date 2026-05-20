-- ══════════════════════════════════════════════════════════════════════
-- Rate Limit DB 마이그레이션 (HIGH H6 대응)
-- 목적: parent-auth 등 Edge Function 의 rate limit 을 메모리에서
--       madi_rate_limits 테이블로 옮겨 인스턴스 재시작에도 유지
-- 실행 방법: Supabase 대시보드 > SQL Editor 에서 실행
-- ══════════════════════════════════════════════════════════════════════

-- ── 1. 테이블 ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS madi_rate_limits (
  key           text PRIMARY KEY,
  count         integer     NOT NULL DEFAULT 0,
  window_start  timestamptz NOT NULL DEFAULT now(),
  hour_count    integer     NOT NULL DEFAULT 0,
  hour_start    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_madi_rate_limits_updated
  ON madi_rate_limits (updated_at);

-- ── 2. RPC: 한 번 호출에 카운트 증가 + 결과 반환 ──────────────────────
CREATE OR REPLACE FUNCTION madi_rate_limit_hit(
  p_key            text,
  p_min_window_ms  bigint,
  p_hour_window_ms bigint
) RETURNS TABLE(count int, hour_count int, window_start timestamptz, hour_start timestamptz)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_now      timestamptz := now();
  v_min_int  interval    := make_interval(secs => p_min_window_ms  / 1000.0);
  v_hour_int interval    := make_interval(secs => p_hour_window_ms / 1000.0);
  v_row      madi_rate_limits%ROWTYPE;
BEGIN
  -- 초기 행 보장
  INSERT INTO madi_rate_limits(key) VALUES (p_key)
  ON CONFLICT (key) DO NOTHING;

  -- 행 잠금
  SELECT * INTO v_row FROM madi_rate_limits WHERE key = p_key FOR UPDATE;

  -- 분 윈도우 만료 시 리셋
  IF v_now - v_row.window_start > v_min_int THEN
    v_row.count        := 0;
    v_row.window_start := v_now;
  END IF;
  -- 시간 윈도우 만료 시 리셋
  IF v_now - v_row.hour_start > v_hour_int THEN
    v_row.hour_count := 0;
    v_row.hour_start := v_now;
  END IF;

  v_row.count      := v_row.count + 1;
  v_row.hour_count := v_row.hour_count + 1;
  v_row.updated_at := v_now;

  UPDATE madi_rate_limits
  SET    count        = v_row.count,
         window_start = v_row.window_start,
         hour_count   = v_row.hour_count,
         hour_start   = v_row.hour_start,
         updated_at   = v_row.updated_at
  WHERE  key = p_key;

  count        := v_row.count;
  hour_count   := v_row.hour_count;
  window_start := v_row.window_start;
  hour_start   := v_row.hour_start;
  RETURN NEXT;
END;
$$;

-- ── 3. 청소 정책 (선택, 30일 이상 미사용 키 제거) ─────────────────────
-- 주기적으로 실행:
-- DELETE FROM madi_rate_limits WHERE updated_at < now() - interval '30 days';
