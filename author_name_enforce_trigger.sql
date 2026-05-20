-- ══════════════════════════════════════════════════════════════════════
-- author_name 위장 차단 트리거 (HIGH H3 대응)
-- 목적: INSERT/UPDATE 시 author_name 을 클라이언트 값이 아닌
--       author_id → madi_users.name 로 강제 매핑하여 동명이인 위장 차단
--
-- 실행 방법: Supabase 대시보드 > SQL Editor 에 붙여넣고 실행
-- 사전조건: author_id_migration.sql 이 먼저 적용되어 있어야 함
-- ══════════════════════════════════════════════════════════════════════

-- ── 1. 공통 트리거 함수 ──────────────────────────────────────────────
CREATE OR REPLACE FUNCTION madi_enforce_author_name()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_name text;
BEGIN
  -- author_id 가 없으면 그대로 통과 (과거 데이터 호환)
  IF NEW.author_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT u.name INTO v_name
  FROM   madi_users u
  WHERE  u.id::text = NEW.author_id::text
  LIMIT  1;

  -- 매칭되는 사용자가 있으면 클라이언트가 보낸 값을 덮어쓴다
  IF v_name IS NOT NULL THEN
    NEW.author_name := v_name;
  END IF;

  RETURN NEW;
END;
$$;

-- ── 2. 게시판 / 댓글 / 공지에 트리거 부착 ─────────────────────────────
-- 테이블이 존재하고 author_id + author_name 컬럼을 모두 가진 경우에만 트리거 부착
-- (스키마에 없는 테이블이 있어도 에러 없이 통과)
DO $do$
DECLARE
  t text;
  tables text[] := ARRAY[
    'madi_lounge_posts',
    'madi_lounge_comments',
    'madi_notices',
    'madi_global_notices',
    'madi_center_notices',
    'madi_inquiries'
  ];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    IF EXISTS (
      SELECT 1
      FROM   information_schema.columns
      WHERE  table_schema = 'public'
        AND  table_name   = t
        AND  column_name  = 'author_id'
    ) AND EXISTS (
      SELECT 1
      FROM   information_schema.columns
      WHERE  table_schema = 'public'
        AND  table_name   = t
        AND  column_name  = 'author_name'
    ) THEN
      EXECUTE format(
        'DROP TRIGGER IF EXISTS %I ON %I; '
        'CREATE TRIGGER %I BEFORE INSERT OR UPDATE ON %I '
        '  FOR EACH ROW EXECUTE FUNCTION madi_enforce_author_name();',
        'trg_' || t || '_author_name', t,
        'trg_' || t || '_author_name', t
      );
      RAISE NOTICE '✓ trigger attached: %', t;
    ELSE
      RAISE NOTICE '⊘ skipped (table or columns missing): %', t;
    END IF;
  END LOOP;
END
$do$;

-- ── 3. 확인 쿼리 (선택) ───────────────────────────────────────────────
-- 트리거가 잘 붙었는지 확인:
-- SELECT event_object_table, trigger_name
-- FROM   information_schema.triggers
-- WHERE  trigger_name LIKE 'trg_madi_%_author_name';
