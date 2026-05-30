-- ══════════════════════════════════════════════════════════════════════
-- madi_notices / madi_global_notices author_id 컬럼 추가 + 백필
-- 목적: 두 공지 테이블에 author_id 컬럼이 없어 author_name 위장 차단
--       트리거(author_name_enforce_trigger.sql)가 적용되지 않던 문제 해결
-- ══════════════════════════════════════════════════════════════════════

-- 컬럼 추가 + 백필 전체를 단일 트랜잭션으로 — 원자성 보장
BEGIN;

-- ── 1. madi_notices ────────────────────────────────────────────────────
ALTER TABLE madi_notices
  ADD COLUMN IF NOT EXISTS author_id text;

-- 동명이인 가드: 같은 (이름, 센터) 사용자가 정확히 1명일 때만 매칭.
-- 2명 이상이면 임의 매칭 위험 → NULL 유지(트리거가 안전 처리).
UPDATE madi_notices n
SET    author_id = u.id::text
FROM   madi_users u
WHERE  n.author_id IS NULL
  AND  n.author_name IS NOT NULL
  AND  n.author_name = u.name
  AND  (n.center_id IS NULL OR n.center_id = u.center_id)
  AND  (
    SELECT count(*) FROM madi_users uu
    WHERE  uu.name = n.author_name
      AND  (n.center_id IS NULL OR uu.center_id = n.center_id)
  ) = 1;

-- ── 2. madi_global_notices ────────────────────────────────────────────
ALTER TABLE madi_global_notices
  ADD COLUMN IF NOT EXISTS author_id text;

-- global_notices 는 슈퍼어드민이 작성하므로 center_id 매칭 불필요.
-- 동명이인 가드: 같은 이름의 사용자가 전체에서 정확히 1명일 때만 매칭.
UPDATE madi_global_notices g
SET    author_id = u.id::text
FROM   madi_users u
WHERE  g.author_id IS NULL
  AND  g.author_name IS NOT NULL
  AND  g.author_name = u.name
  AND  (
    SELECT count(*) FROM madi_users uu
    WHERE  uu.name = g.author_name
  ) = 1;

COMMIT;

-- ── 3. 트리거 재부착 (author_name_enforce_trigger.sql 의 DO 블록 재실행) ─
DO $do$
DECLARE
  t text;
  tables text[] := ARRAY['madi_notices', 'madi_global_notices'];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema='public' AND table_name=t AND column_name='author_id'
    ) AND EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema='public' AND table_name=t AND column_name='author_name'
    ) THEN
      EXECUTE format(
        'DROP TRIGGER IF EXISTS %I ON %I; '
        'CREATE TRIGGER %I BEFORE INSERT OR UPDATE ON %I '
        '  FOR EACH ROW EXECUTE FUNCTION madi_enforce_author_name();',
        'trg_' || t || '_author_name', t,
        'trg_' || t || '_author_name', t
      );
      RAISE NOTICE '✓ trigger attached: %', t;
    END IF;
  END LOOP;
END
$do$;

-- ── 4. 확인 쿼리 (선택) ────────────────────────────────────────────────
-- SELECT id, author_id, author_name FROM madi_notices         WHERE author_id IS NULL;
-- SELECT id, author_id, author_name FROM madi_global_notices  WHERE author_id IS NULL;
