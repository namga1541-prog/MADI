-- ══════════════════════════════════════════════════════════════════════
-- 월간 포트폴리오 (madi_portfolios)
-- 목적: 선생님이 AI 로 생성한 월간 포트폴리오를 영속화하고,
--       학부모에게는 선생님이 명시적으로 OPEN 한 항목만 노출.
-- 배경: 극성 학부모로부터 선생님을 보호하기 위해 가시성을 100% 선생님 결정으로 둠.
--       세션 기록(madi_sessions) 은 학부모에게 차단되고,
--       포트폴리오만이 학부모-선생님 사이의 정제된 단일 채널이 됨.
-- 적용: supabase db query --linked --file madi_portfolios_setup.sql
-- ══════════════════════════════════════════════════════════════════════

-- ── 1. 테이블 ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS madi_portfolios (
  id              bigserial   PRIMARY KEY,
  center_id       text        NOT NULL,
  child_id        bigint      NOT NULL,
  month           text        NOT NULL,                  -- 'YYYY-MM'
  content         jsonb       NOT NULL,                  -- AI 생성 결과 본문
  created_by      bigint,                                -- 생성한 선생님/관리자 user id
  created_by_name text,                                  -- 캐싱 (선생님 탈퇴 후에도 표기 유지)
  parent_visible  boolean     NOT NULL DEFAULT false,    -- 기본 비공개 (선생님 명시 OPEN 필요)
  opened_at       timestamptz,                           -- OPEN 한 시점 (감사용)
  opened_by       bigint,                                -- OPEN 한 user id
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

-- 동일 센터·아동·월 조합은 1건 (재생성 시 UPSERT)
CREATE UNIQUE INDEX IF NOT EXISTS idx_madi_portfolios_unique
  ON madi_portfolios (center_id, child_id, month);

-- 조회 최적화 — 선생님 측: 아동별 최신순 / 학부모 측: child_id + parent_visible
CREATE INDEX IF NOT EXISTS idx_madi_portfolios_child
  ON madi_portfolios (center_id, child_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_madi_portfolios_visible
  ON madi_portfolios (child_id, parent_visible, created_at DESC)
  WHERE parent_visible = true;

-- updated_at 자동 갱신 트리거
CREATE OR REPLACE FUNCTION madi_portfolios_touch_updated_at()
  RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  -- parent_visible 이 false→true 로 바뀌면 opened_at 자동 기록 (기록 보존)
  IF (TG_OP = 'UPDATE') AND (OLD.parent_visible IS DISTINCT FROM NEW.parent_visible) THEN
    IF NEW.parent_visible THEN
      NEW.opened_at = COALESCE(NEW.opened_at, now());
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_madi_portfolios_touch ON madi_portfolios;
CREATE TRIGGER trg_madi_portfolios_touch
  BEFORE UPDATE ON madi_portfolios
  FOR EACH ROW EXECUTE FUNCTION madi_portfolios_touch_updated_at();

-- ── 2. RLS ─────────────────────────────────────────────────────────────
-- 다른 학부모 격리 + anon 차단. Edge Function 은 service_role 로 우회하므로
-- 클라이언트 anon key 의 직접 접근만 차단하면 됨.
ALTER TABLE madi_portfolios ENABLE ROW LEVEL SECURITY;

-- 모든 anon 직접 접근 차단
DROP POLICY IF EXISTS "madi_portfolios_deny_anon" ON madi_portfolios;
CREATE POLICY "madi_portfolios_deny_anon" ON madi_portfolios
  AS RESTRICTIVE FOR ALL TO anon USING (false) WITH CHECK (false);

-- service_role 은 통과 (Edge Function 전용)
DROP POLICY IF EXISTS "madi_portfolios_service_all" ON madi_portfolios;
CREATE POLICY "madi_portfolios_service_all" ON madi_portfolios
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- 확인 쿼리
SELECT 'madi_portfolios setup complete' AS status,
       (SELECT COUNT(*) FROM madi_portfolios) AS row_count;
