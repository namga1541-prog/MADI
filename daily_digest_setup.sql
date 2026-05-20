-- ══════════════════════════════════════════════════════════════════════
-- 일일 운영 다이제스트 (보너스 A)
-- 목적: 슈퍼어드민에게 매일 자정 (KST 09:00 UTC) 인앱 알림으로 전송
--       - 직전 24h 의 에러 건수
--       - 감사 로그 활동 요약 (행위자별 / 액션별)
--       - 라운지 / 공지 신규 활동 건수
-- 사전조건: pg_cron extension 활성, madi_audit_log / madi_error_logs / madi_notifications 존재
-- ══════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION madi_send_daily_digest()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_since           timestamptz := now() - interval '24 hours';
  v_err_count       int;
  v_audit_total     int;
  v_audit_insert    int;
  v_audit_update    int;
  v_audit_delete    int;
  v_top_actors      text;
  v_lounge_new      int;
  v_notice_new      int;
  v_logins_failed   int;
  v_body            text;
  v_super_id        uuid;
  v_inserted        int := 0;
BEGIN
  -- 1) 에러 건수 (madi_error_logs.ts 는 bigint(ms) — created_at timestamptz 사용)
  SELECT COUNT(*) INTO v_err_count FROM madi_error_logs WHERE created_at >= v_since;

  -- 2) 감사 로그 요약
  SELECT COUNT(*) INTO v_audit_total  FROM madi_audit_log WHERE occurred_at >= v_since;
  SELECT COUNT(*) INTO v_audit_insert FROM madi_audit_log WHERE occurred_at >= v_since AND action='INSERT';
  SELECT COUNT(*) INTO v_audit_update FROM madi_audit_log WHERE occurred_at >= v_since AND action='UPDATE';
  SELECT COUNT(*) INTO v_audit_delete FROM madi_audit_log WHERE occurred_at >= v_since AND action='DELETE';

  -- 3) 활동 많은 사용자 top 3
  SELECT string_agg(name_count, ', ' ORDER BY cnt DESC)
  INTO   v_top_actors
  FROM (
    SELECT (SELECT name FROM madi_users WHERE id = a.actor_id) || ' ' || cnt::text AS name_count, cnt
    FROM   (
      SELECT actor_id, COUNT(*) AS cnt
      FROM   madi_audit_log
      WHERE  occurred_at >= v_since AND actor_id IS NOT NULL
      GROUP  BY actor_id
      ORDER  BY COUNT(*) DESC
      LIMIT  3
    ) a
  ) x;

  -- 4) 라운지 / 공지 신규 활동
  SELECT COUNT(*) INTO v_lounge_new FROM madi_lounge_posts WHERE created_at >= v_since;
  SELECT COUNT(*) INTO v_notice_new FROM madi_notices      WHERE created_at >= v_since;

  -- 5) 로그인 실패 (madi_error_logs 안에서 message 패턴 매칭 — 명시적 실패 로그는 별도 분류 미적용)
  SELECT COUNT(*) INTO v_logins_failed
  FROM   madi_error_logs
  WHERE  created_at >= v_since AND (message ILIKE '%login%fail%' OR message ILIKE '%401%' OR message ILIKE '%인증%');

  -- 6) 본문 작성
  v_body :=
    '🔍 직전 24시간 활동 요약' || E'\n' ||
    '· 에러: '       || v_err_count    || '건' || E'\n' ||
    '· 데이터 변경: '|| v_audit_total  || '건 (생성 ' || v_audit_insert ||
                       ' / 수정 '       || v_audit_update ||
                       ' / 삭제 '       || v_audit_delete || ')' || E'\n' ||
    '· 라운지 신규: '|| v_lounge_new   || '건, 공지 신규: ' || v_notice_new || '건' || E'\n' ||
    '· 인증 실패 추정: ' || v_logins_failed || '건' ||
    CASE WHEN v_top_actors IS NOT NULL
         THEN E'\n· 활발 사용자: ' || v_top_actors
         ELSE '' END;

  -- 7) 슈퍼어드민 전원에게 알림 row INSERT
  FOR v_super_id IN
    SELECT id FROM madi_users WHERE role = 'superadmin'
  LOOP
    INSERT INTO madi_notifications(user_id, center_id, type, title, body)
    VALUES (
      v_super_id,
      NULL,
      'digest',
      '📊 운영 다이제스트 (' || to_char(now() AT TIME ZONE 'Asia/Seoul', 'MM/DD') || ')',
      v_body
    );
    v_inserted := v_inserted + 1;
  END LOOP;

  RAISE NOTICE 'madi_send_daily_digest: % notifications inserted', v_inserted;
END;
$$;

-- ── pg_cron 스케줄 등록 ──────────────────────────────────────────────
-- 09:00 UTC = KST 18:00 (오후 6시) — 운영 종료 시각에 다음날 점검 준비
-- 기존 스케줄이 있으면 먼저 해제 후 재등록
SELECT cron.unschedule('madi-daily-digest')
WHERE  EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'madi-daily-digest');

SELECT cron.schedule(
  'madi-daily-digest',
  '0 9 * * *',
  $cron$SELECT madi_send_daily_digest();$cron$
);

-- 확인:
-- SELECT jobname, schedule, active FROM cron.job WHERE jobname='madi-daily-digest';
