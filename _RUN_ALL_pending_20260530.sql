-- ════════════════════════════════════════════════════════════════
-- MADI 보안 적용 통합 SQL (2026-05-30) — SQL Editor 에 통째로 붙여넣고 Run
-- 전부 재실행 안전(멱등). Storage 버킷 비공개 전환은 포함 안 함(이미지 검증 후 별도).
-- 포함: ① 감사 트리거(actor 기록) ② 보안 하드닝(REVOKE/search_path/anon차단/rate clamp)
--       ③④ 작성자 백필 동명이인 가드
-- ════════════════════════════════════════════════════════════════

-- ===== ① audit_log_setup.sql =====
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


-- ===== ② security_hardening_20260530.sql =====
-- ══════════════════════════════════════════════════════════════════════
-- 보안 하드닝 (감사 후속 — 2026-05-30)
-- 목적: SECURITY DEFINER 함수 직접 호출 차단(REVOKE EXECUTE) +
--       헬퍼 함수 search_path 고정 + rate-limit 입력 하한 +
--       anon/authenticated RESTRICTIVE 차단 정책 보강
-- 배경: 클라이언트는 api Edge Function(service_role)으로만 DB 접근(RLS 우회).
--       현재 anon 키 미배포라 미악용이나, SECURITY DEFINER 함수에
--       REVOKE EXECUTE 가 전혀 없어 anon/authenticated 가 직접 호출 가능 →
--       defense-in-depth 로 사전 차단.
-- 성격: 멱등(re-runnable) · additive — 기존 *.sql 적용 후 마지막에 실행.
-- 실행 위치: Supabase Dashboard > SQL Editor
-- 의존: rate_limits_setup.sql / daily_digest_setup.sql / audit_log_setup.sql /
--       author_name_enforce_trigger.sql / rls_security_setup.sql /
--       parent_isolation_rls.sql / madi_notifications_setup.sql /
--       madi_push_setup.sql 이 먼저 적용되어 있어야 함.
-- ══════════════════════════════════════════════════════════════════════


-- ───────────────────────────────────────────────────────────────────
-- 1. search_path 고정 (madi_my_role / madi_my_center_id)
--    원 정의(rls_security_setup.sql)는 SET search_path 가 없어
--    SECURITY DEFINER 함수의 search_path 하이재킹 위험 → public 고정.
--    원 로직(STABLE / SECURITY DEFINER) 그대로 보존, search_path 만 추가.
-- ───────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION madi_my_center_id()
RETURNS text LANGUAGE sql SECURITY DEFINER STABLE
SET search_path = public AS $$
  SELECT center_id FROM madi_users WHERE id = auth.uid()
$$;

CREATE OR REPLACE FUNCTION madi_my_role()
RETURNS text LANGUAGE sql SECURITY DEFINER STABLE
SET search_path = public AS $$
  SELECT role FROM madi_users WHERE id = auth.uid()
$$;


-- ───────────────────────────────────────────────────────────────────
-- 2. rate-limit 입력 하한 (clamp)
--    p_min_window_ms / p_hour_window_ms 를 검증 없이 interval 로 변환하면
--    호출자가 0 또는 음수를 보내 윈도우를 무력화(=무제한 허용)할 수 있음.
--    원 로직(rate_limits_setup.sql) 보존 + 하한 클램프만 추가.
--    하한: 분 윈도우 1000ms(1s), 시간 윈도우 60000ms(60s).
-- ───────────────────────────────────────────────────────────────────
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
  -- 하한 클램프: 0/음수/과소 입력으로 rate limit 무력화 방지
  v_min_ms   bigint      := GREATEST(p_min_window_ms,  1000);
  v_hour_ms  bigint      := GREATEST(p_hour_window_ms, 60000);
  v_min_int  interval    := make_interval(secs => v_min_ms  / 1000.0);
  v_hour_int interval    := make_interval(secs => v_hour_ms / 1000.0);
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


-- ───────────────────────────────────────────────────────────────────
-- 3. cleanup_old_notifications: search_path 고정 보강
--    madi_notifications_setup.sql 의 원 정의는 SECURITY DEFINER 도 아니고
--    search_path 도 없음. SECURITY DEFINER 로 cron/서비스에서 실행되며
--    public 고정이 안전 — 원 로직 보존 + 속성만 보강.
-- ───────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION cleanup_old_notifications()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM madi_notifications
  WHERE read_at IS NOT NULL
    AND read_at < now() - interval '30 days';
END;
$$;


-- ───────────────────────────────────────────────────────────────────
-- 4. REVOKE EXECUTE — 모든 SECURITY DEFINER 함수 직접 호출 차단
--    FROM PUBLIC, anon, authenticated 회수 → service_role/postgres 만 호출.
--    정확한 인자 시그니처로 REVOKE (오버로드 안전).
--    존재하지 않는 함수는 to_regprocedure() 로 가드 → 멱등.
-- ───────────────────────────────────────────────────────────────────
DO $do$
DECLARE
  fn   text;
  sigs text[] := ARRAY[
    'madi_rate_limit_hit(text, bigint, bigint)',
    'madi_send_daily_digest()',
    'madi_my_role()',
    'madi_my_center_id()',
    'madi_my_child_ids()',
    'madi_log_audit()',
    'madi_enforce_author_name()',
    'cleanup_old_notifications()'
  ];
BEGIN
  FOREACH fn IN ARRAY sigs LOOP
    IF to_regprocedure(fn) IS NOT NULL THEN
      EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC;',        fn);
      EXECUTE format('REVOKE ALL ON FUNCTION %s FROM anon;',          fn);
      EXECUTE format('REVOKE ALL ON FUNCTION %s FROM authenticated;', fn);
      -- service_role / postgres 는 명시적으로 유지(트리거·cron·Edge Function용)
      EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role;',  fn);
      RAISE NOTICE '✓ REVOKE EXECUTE (PUBLIC/anon/authenticated): %', fn;
    ELSE
      RAISE NOTICE '⊘ skipped (function not found): %', fn;
    END IF;
  END LOOP;
END
$do$;


-- ───────────────────────────────────────────────────────────────────
-- 5. madi_notifications — anon/authenticated RESTRICTIVE 차단 보강
--    기존 정책(rls_security_setup.sql / madi_notifications_setup.sql)은
--    PERMISSIVE select/update 만 정의 → INSERT/DELETE 경로 및
--    anon 전면 차단이 명시적이지 않음. RESTRICTIVE 로 anon/authenticated
--    전체(ALL) 를 무조건 차단(USING/ WITH CHECK false).
--    (service_role 은 RLS 우회 → 영향 없음. RESTRICTIVE 는 기존 PERMISSIVE
--     와 AND 결합되나 anon/authenticated 롤에만 적용되므로 정상 사용 무영향.)
-- ───────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "madi_notifications_anon_block" ON madi_notifications;
CREATE POLICY "madi_notifications_anon_block" ON madi_notifications
  AS RESTRICTIVE FOR ALL
  TO anon, authenticated
  USING (false) WITH CHECK (false);


-- ───────────────────────────────────────────────────────────────────
-- 6. madi_push_settings — anon/authenticated RESTRICTIVE 차단 보강
--    madi_push_setup.sql 의 anon_block_cfg 는 FOR ALL TO anon USING(false)
--    만 있고 WITH CHECK 가 없어 INSERT/UPDATE WITH CHECK 경로가 빈다.
--    또한 authenticated 롤은 커버되지 않음 → RESTRICTIVE 로 보강.
-- ───────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "madi_push_settings_anon_block" ON madi_push_settings;
CREATE POLICY "madi_push_settings_anon_block" ON madi_push_settings
  AS RESTRICTIVE FOR ALL
  TO anon, authenticated
  USING (false) WITH CHECK (false);


-- ───────────────────────────────────────────────────────────────────
-- 7. madi_push_subscriptions — RLS 활성 + anon/authenticated 차단 보강
--    구독 테이블은 endpoint/p256dh/auth(푸시 키) 보관 → 직접 접근 차단 필요.
--    (테이블 존재 시에만 적용; RLS 가 미활성일 수 있어 ENABLE 보장.)
-- ───────────────────────────────────────────────────────────────────
DO $do$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'madi_push_subscriptions'
  ) THEN
    EXECUTE 'ALTER TABLE madi_push_subscriptions ENABLE ROW LEVEL SECURITY';
    EXECUTE 'DROP POLICY IF EXISTS "madi_push_subscriptions_anon_block" ON madi_push_subscriptions';
    EXECUTE 'CREATE POLICY "madi_push_subscriptions_anon_block" ON madi_push_subscriptions '
         || 'AS RESTRICTIVE FOR ALL TO anon, authenticated '
         || 'USING (false) WITH CHECK (false)';
    RAISE NOTICE '✓ madi_push_subscriptions RLS + anon block 적용';
  ELSE
    RAISE NOTICE '⊘ skipped (table not found): madi_push_subscriptions';
  END IF;
END
$do$;


-- ───────────────────────────────────────────────────────────────────
-- 8. 검증 쿼리 (실행 후 확인용)
-- ───────────────────────────────────────────────────────────────────
-- 함수 권한 확인 (anon/authenticated 에 EXECUTE 가 없어야 함):
--   SELECT p.proname, r.rolname, has_function_privilege(r.rolname, p.oid, 'EXECUTE') AS can_exec
--   FROM   pg_proc p
--   CROSS  JOIN (SELECT unnest(ARRAY['anon','authenticated','service_role']) AS rolname) r
--   WHERE  p.proname IN ('madi_rate_limit_hit','madi_send_daily_digest','madi_my_role',
--                        'madi_my_center_id','madi_my_child_ids','madi_log_audit',
--                        'madi_enforce_author_name','cleanup_old_notifications')
--   ORDER  BY p.proname, r.rolname;
--
-- search_path 고정 확인:
--   SELECT proname, proconfig FROM pg_proc
--   WHERE proname IN ('madi_my_role','madi_my_center_id','madi_rate_limit_hit','cleanup_old_notifications');
--
-- RESTRICTIVE 정책 확인:
--   SELECT tablename, policyname, permissive, roles, cmd
--   FROM pg_policies
--   WHERE policyname LIKE '%anon_block%' ORDER BY tablename;


-- ===== ③ author_id_migration.sql =====
-- ══════════════════════════════════════════════════════════════════════
-- author_id 마이그레이션 SQL
-- 목적: madi_lounge_posts / madi_lounge_comments 의 과거 데이터(author_id=NULL)에
--       madi_users.id 를 채워 author_name 동명이인 fallback을 제거 가능하게 함
--
-- 실행 방법: Supabase 대시보드 > SQL Editor에 붙여넣고 실행
-- 주의: 실행 전 백업 권장 (SELECT * FROM madi_lounge_posts 로 확인)
-- ══════════════════════════════════════════════════════════════════════

-- 전체 백필을 단일 트랜잭션으로 — 중간 실패 시 부분 매칭 방지(원자성)
BEGIN;

-- ── 1. madi_lounge_posts: author_id NULL인 행을 author_name으로 매칭 ──────
-- 동명이인 가드: 같은 (이름, 센터) 조합의 사용자가 정확히 1명일 때만 매칭.
-- 2명 이상이면 임의 매칭 위험 → 채우지 않고 NULL 유지(트리거가 안전하게 처리).
UPDATE madi_lounge_posts p
SET    author_id = u.id::text
FROM   madi_users u
WHERE  p.author_id IS NULL
  AND  p.author_name IS NOT NULL
  AND  p.author_name = u.name
  AND  (p.center_id IS NULL OR p.center_id = u.center_id)
  AND  (
    SELECT count(*) FROM madi_users uu
    WHERE  uu.name = p.author_name
      AND  (p.center_id IS NULL OR uu.center_id = p.center_id)
  ) = 1;

-- 확인: 여전히 author_id가 NULL인 행 (동명이인으로 모호해서 채우지 못한 경우)
-- SELECT id, author_name, center_id FROM madi_lounge_posts WHERE author_id IS NULL;

-- ── 2. madi_lounge_comments: 같은 방식으로 처리 ──────────────────────────
-- 댓글에는 center_id 컬럼이 없으므로 부모 글(post)의 center_id 로 격리 조인.
-- 동명이인 가드: (이름, 부모글 센터) 기준 유일한 사용자일 때만 매칭.
UPDATE madi_lounge_comments c
SET    author_id = u.id::text
FROM   madi_users u
WHERE  c.author_id IS NULL
  AND  c.author_name IS NOT NULL
  AND  c.author_name = u.name
  AND  (
    SELECT count(*) FROM madi_users uu
    WHERE  uu.name = c.author_name
      AND  uu.center_id IS NOT DISTINCT FROM (
             SELECT p.center_id FROM madi_lounge_posts p WHERE p.id = c.post_id
           )
  ) = 1
  AND  u.center_id IS NOT DISTINCT FROM (
         SELECT p.center_id FROM madi_lounge_posts p WHERE p.id = c.post_id
       );

COMMIT;

-- 확인
-- SELECT id, author_name FROM madi_lounge_comments WHERE author_id IS NULL;

-- ── 3. 마이그레이션 후 클라이언트 코드에서 author_name fallback 제거 ────────
-- 아래 파일들의 fallback 패턴을 제거해야 함:
-- madi-14.js filterLoungePosts(): p.author_name === name → 제거
-- madi-14.js renderLoungeUI(): p.author_name !== user.name → 제거
-- madi-14.js renderInquiryCard(): post.author_name === user.name → 제거
-- madi-14.js renderComments(): c.author_name === user.name → 제거
-- (모두 author_id 기반으로만 판단하도록 변경)


-- ===== ④ notices_author_id_migration.sql =====
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
