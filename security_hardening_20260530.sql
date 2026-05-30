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
