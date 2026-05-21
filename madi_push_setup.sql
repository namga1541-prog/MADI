-- ══════════════════════════════════════════════════════════════════════
-- 마디 앱 — Web Push 알림 시스템
-- 실행: Supabase Dashboard > SQL Editor
-- ══════════════════════════════════════════════════════════════════════

-- ── 1. 구독 정보 테이블 (기기별) ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS madi_push_subscriptions (
  id          bigserial   PRIMARY KEY,
  user_id     bigint      NOT NULL,          -- madi_users.id
  center_id   text        NOT NULL,
  endpoint    text        NOT NULL,          -- push 서비스 URL (브라우저 발급)
  p256dh      text        NOT NULL,          -- 페이로드 암호화 공개키
  auth_key    text        NOT NULL,          -- 인증 시크릿
  created_at  timestamptz DEFAULT now(),
  UNIQUE(user_id, endpoint)                  -- 같은 기기 중복 방지
);

-- ── 2. 센터별 알림 설정 테이블 ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS madi_push_settings (
  center_id       text        PRIMARY KEY,
  push_time       text        NOT NULL DEFAULT '20:00',
  message_title   text        NOT NULL DEFAULT '내일 치료 예약 안내',
  message_body    text        NOT NULL DEFAULT '{아동이름}의 치료가 내일 {시간}에 예정되어 있습니다.',
  enabled         boolean     NOT NULL DEFAULT true,
  last_sent_date  text                         -- 'YYYY-MM-DD' KST (중복 발송 방지)
);

-- ── 3. 인덱스 ───────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_push_sub_user   ON madi_push_subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_push_sub_center ON madi_push_subscriptions(center_id);

-- ── 4. RLS ─────────────────────────────────────────────────────────
ALTER TABLE madi_push_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE madi_push_settings      ENABLE ROW LEVEL SECURITY;

-- service_role (Edge Function) 전체 허용
CREATE POLICY "svc_all_sub" ON madi_push_subscriptions TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "svc_all_cfg" ON madi_push_settings      TO service_role USING (true) WITH CHECK (true);

-- anon 차단
CREATE POLICY "anon_block_sub" ON madi_push_subscriptions FOR ALL TO anon USING (false);
CREATE POLICY "anon_block_cfg" ON madi_push_settings      FOR ALL TO anon USING (false);
