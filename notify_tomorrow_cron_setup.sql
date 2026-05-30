-- ══════════════════════════════════════════════════════════════════════
-- notify-tomorrow Edge Function — pg_cron 트리거 설정 (무인증 cron 보호)
-- 목적: 10분마다 notify-tomorrow 를 호출하되, x-cron-secret 헤더로 인증해
--       외부 무인증 호출(대량 푸시 발송 악용)을 차단한다.
--
-- ⚠️ 운영 적용 필수 조건 (둘 다 동시에 설정해야 함):
--   1) Edge Function 시크릿:  supabase secrets set CRON_SECRET=<강한 랜덤값>
--   2) 아래 net.http_post 헤더의 x-cron-secret 값을 동일한 <강한 랜덤값> 으로 치환
--   둘 중 하나만 설정하면:
--     - CRON_SECRET 만 설정 → 트리거 헤더 불일치로 401 (푸시 안 됨)
--     - 헤더만 설정       → 함수가 CRON_SECRET 미설정으로 인식해 경고만 남기고 통과(하위호환)
--
-- 기존에 Supabase Dashboard > Edge Functions > notify-tomorrow > Schedule 로
-- 등록된 cron 이 있다면, 그 방식은 커스텀 헤더를 못 실어 보안 적용이 불가하므로
-- 이 pg_cron 방식으로 교체하고 Dashboard 스케줄은 비활성화할 것.
--
-- 사전조건: pg_cron + pg_net extension 활성 (Supabase Dashboard > Database > Extensions)
-- ══════════════════════════════════════════════════════════════════════

-- ── extension 확인 ────────────────────────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    RAISE EXCEPTION 'pg_cron extension 이 활성화되지 않았습니다. Dashboard > Database > Extensions 에서 활성화하세요.';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_net') THEN
    RAISE EXCEPTION 'pg_net extension 이 활성화되지 않았습니다. Dashboard > Database > Extensions 에서 활성화하세요.';
  END IF;
END $$;

-- ── 기존 스케줄 해제 후 재등록 ────────────────────────────────────────
SELECT cron.unschedule('madi-notify-tomorrow')
WHERE  EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'madi-notify-tomorrow');

-- ── 10분마다 notify-tomorrow 호출 ─────────────────────────────────────
-- ⚠️ 아래 두 값을 운영 환경에 맞게 치환:
--    <PROJECT_REF>      : ujxdhafzjyrglaclarwe
--    <CRON_SECRET_VALUE>: supabase secrets 의 CRON_SECRET 과 동일한 값
SELECT cron.schedule(
  'madi-notify-tomorrow',
  '*/10 * * * *',
  $cron$
    SELECT net.http_post(
      url     := 'https://ujxdhafzjyrglaclarwe.supabase.co/functions/v1/notify-tomorrow',
      headers := jsonb_build_object(
        'Content-Type',   'application/json',
        'x-cron-secret',  '<CRON_SECRET_VALUE>'   -- ← CRON_SECRET env 와 동일하게 치환
      ),
      body    := '{}'::jsonb
    );
  $cron$
);

-- 확인:
-- SELECT jobname, schedule, active FROM cron.job WHERE jobname='madi-notify-tomorrow';
