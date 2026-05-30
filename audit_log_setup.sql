-- ══════════════════════════════════════════════════════════════════════
-- 감사 로그 (madi_audit_log)
-- 목적: 의료성 데이터(아동·세션·평가·IEP) 변경 이력 보관
--       PIPA 컴플라이언스 + 운영 감사 추적 + 비정상 행위 탐지
-- 동작: 핵심 테이블에 AFTER INSERT/UPDATE/DELETE 트리거 부착,
--       작업자(auth.uid()), 시각, 대상 row 의 식별자만 기록 (PII 본문 미저장)
-- ══════════════════════════════════════════════════════════════════════

-- ── 1. 테이블 ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS madi_audit_log (
  id           bigserial   PRIMARY KEY,
  occurred_at  timestamptz NOT NULL DEFAULT now(),
  actor_id     uuid,                 -- auth.uid() 시점의 사용자
  actor_role   text,                 -- 시점의 madi_my_role()
  action       text        NOT NULL, -- 'INSERT' | 'UPDATE' | 'DELETE'
  table_name   text        NOT NULL,
  row_id       text,                 -- 변경 대상 PK
  center_id    text,                 -- 격리·필터링용
  child_id     text,                 -- 자녀 관련 테이블이면 자녀 id
  changed_cols text[],               -- UPDATE 인 경우 변경된 컬럼명
  client_ip    text,                 -- 가능하면 (PostgREST 헤더 통해 전달)
  user_agent   text
);

CREATE INDEX IF NOT EXISTS idx_madi_audit_log_occurred ON madi_audit_log (occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_madi_audit_log_actor    ON madi_audit_log (actor_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_madi_audit_log_target   ON madi_audit_log (table_name, row_id);
CREATE INDEX IF NOT EXISTS idx_madi_audit_log_child    ON madi_audit_log (child_id, occurred_at DESC);

-- ── 2. RLS — superadmin/admin 만 본인 센터 + 학부모는 자기 자녀 관련만 ─
ALTER TABLE madi_audit_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "audit_log_select" ON madi_audit_log;
CREATE POLICY "audit_log_select" ON madi_audit_log FOR SELECT
USING (
  madi_my_role() = 'superadmin'
  OR (madi_my_role() = 'admin' AND center_id = madi_my_center_id())
  OR (madi_my_role() = 'parent' AND child_id = ANY(madi_my_child_ids()))
);

-- INSERT/UPDATE/DELETE 는 service_role 만 (트리거에서 SECURITY DEFINER 로 INSERT)
DROP POLICY IF EXISTS "audit_log_service_only_write" ON madi_audit_log;
CREATE POLICY "audit_log_service_only_write" ON madi_audit_log FOR ALL
TO authenticated, anon
USING (false) WITH CHECK (false);

-- ── 3. 공용 트리거 함수 ──────────────────────────────────────────────
CREATE OR REPLACE FUNCTION madi_log_audit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row_id       text;
  v_center_id    text;
  v_child_id     text;
  v_changed_cols text[];
  v_data_new     jsonb;
  v_data_old     jsonb;
  v_hdrs         jsonb;
  v_actor_hdr    text;
  v_role_hdr     text;
BEGIN
  -- 실제 행위자: api Edge Function 이 service_role 로 호출하므로 auth.uid() 는 NULL.
  -- PostgREST request.headers 로 전달된 x-madi-actor-* 를 우선 사용하고, 없으면 auth.uid()/role 폴백.
  BEGIN
    v_hdrs := nullif(current_setting('request.headers', true), '')::jsonb;
  EXCEPTION WHEN OTHERS THEN
    v_hdrs := NULL;
  END;
  v_actor_hdr := v_hdrs ->> 'x-madi-actor-id';
  v_role_hdr  := v_hdrs ->> 'x-madi-actor-role';

  -- row_id 추출 (모든 핵심 테이블이 id 컬럼을 가짐)
  IF TG_OP = 'DELETE' THEN
    v_row_id := COALESCE((OLD)::jsonb ->> 'id', '');
  ELSE
    v_row_id := COALESCE((NEW)::jsonb ->> 'id', '');
  END IF;

  -- center_id (NEW 우선, 없으면 OLD)
  IF TG_OP = 'DELETE' THEN
    v_center_id := (OLD)::jsonb ->> 'center_id';
  ELSE
    v_center_id := (NEW)::jsonb ->> 'center_id';
  END IF;

  -- child_id (자녀 관련 테이블이면 채움)
  IF TG_TABLE_NAME IN ('madi_children') THEN
    v_child_id := v_row_id;
  ELSIF TG_TABLE_NAME = 'madi_schedules' THEN
    IF TG_OP = 'DELETE' THEN
      v_child_id := (OLD)::jsonb ->> 'child_id';
    ELSE
      v_child_id := (NEW)::jsonb ->> 'child_id';
    END IF;
  ELSIF TG_TABLE_NAME IN ('madi_sessions','madi_assessments','madi_iep_history') THEN
    IF TG_OP = 'DELETE' THEN
      v_data_old := (OLD)::jsonb -> 'data';
      v_child_id := COALESCE(v_data_old ->> 'childId', v_data_old ->> 'child_id');
    ELSE
      v_data_new := (NEW)::jsonb -> 'data';
      v_child_id := COALESCE(v_data_new ->> 'childId', v_data_new ->> 'child_id');
    END IF;
  END IF;

  -- UPDATE 시 변경 컬럼 추출
  IF TG_OP = 'UPDATE' THEN
    SELECT array_agg(key)
    INTO   v_changed_cols
    FROM (
      SELECT key FROM jsonb_each((NEW)::jsonb)
      EXCEPT
      SELECT key FROM jsonb_each((OLD)::jsonb)
    ) diff;
    -- 같은 키의 값 차이도 포함 (jsonb_each 비교)
    SELECT array_agg(DISTINCT k)
    INTO   v_changed_cols
    FROM (
      SELECT key AS k FROM jsonb_each((NEW)::jsonb) n
      WHERE  (OLD)::jsonb -> n.key IS DISTINCT FROM n.value
    ) c;
  END IF;

  INSERT INTO madi_audit_log(
    actor_id, actor_role, action, table_name, row_id,
    center_id, child_id, changed_cols
  ) VALUES (
    COALESCE(
      CASE WHEN v_actor_hdr ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
           THEN v_actor_hdr::uuid ELSE NULL END,
      auth.uid()
    ),
    COALESCE(v_role_hdr, madi_my_role()),
    TG_OP,
    TG_TABLE_NAME,
    v_row_id,
    v_center_id,
    v_child_id,
    v_changed_cols
  );

  IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
EXCEPTION WHEN OTHERS THEN
  -- 감사 로그 실패가 본 작업을 막지 않도록 (best-effort)
  RAISE WARNING 'madi_audit_log INSERT failed: %', SQLERRM;
  IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
END;
$$;

-- ── 4. 핵심 테이블에 트리거 부착 ──────────────────────────────────────
DO $do$
DECLARE
  t text;
  tables text[] := ARRAY[
    'madi_children',
    'madi_sessions',
    'madi_schedules',
    'madi_assessments',
    'madi_iep_history',
    'madi_users',
    'madi_parent_children'
  ];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name=t) THEN
      EXECUTE format(
        'DROP TRIGGER IF EXISTS %I ON %I; '
        'CREATE TRIGGER %I AFTER INSERT OR UPDATE OR DELETE ON %I '
        '  FOR EACH ROW EXECUTE FUNCTION madi_log_audit();',
        'trg_audit_' || t, t,
        'trg_audit_' || t, t
      );
      RAISE NOTICE '✓ audit trigger attached: %', t;
    END IF;
  END LOOP;
END
$do$;

-- ── 5. 보존 정책 — 1년 이상 된 로그 자동 정리 (선택, 주기적 실행) ────
-- DELETE FROM madi_audit_log WHERE occurred_at < now() - interval '1 year';

-- ── 6. 코멘트 ─────────────────────────────────────────────────────────
COMMENT ON TABLE madi_audit_log IS '의료성 데이터 변경 감사 로그. PIPA 컴플라이언스. PII 본문은 저장 안 함 (식별자만).';
