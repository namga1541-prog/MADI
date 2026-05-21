-- ══════════════════════════════════════════════════════════════════════
-- 마디 앱 — Web Push 알림 시스템 DB 설정
-- 이미 Supabase에 적용 완료 (2026-05-22) — 참고용으로 보관
-- ══════════════════════════════════════════════════════════════════════

-- ── 1. 기존 madi_push_subscriptions 에 center_id 추가 ─────────────
-- (테이블은 이미 존재; user_id TEXT, auth TEXT 컬럼 사용)
ALTER TABLE madi_push_subscriptions ADD COLUMN IF NOT EXISTS center_id text;
CREATE INDEX IF NOT EXISTS idx_push_sub_center ON madi_push_subscriptions(center_id);

-- ── 2. 센터별 알림 설정 테이블 ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS madi_push_settings (
  center_id       text        PRIMARY KEY,
  push_time       text        NOT NULL DEFAULT '20:00',   -- HH:MM KST
  message_title   text        NOT NULL DEFAULT '내일 치료 예약 안내',
  message_body    text        NOT NULL DEFAULT '{아동이름}의 치료가 내일 {시간}에 예정되어 있습니다.',
  enabled         boolean     NOT NULL DEFAULT true,
  last_sent_date  text                                     -- 'YYYY-MM-DD' KST (중복 발송 방지)
);

-- ── 3. RLS ─────────────────────────────────────────────────────────
ALTER TABLE madi_push_settings ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY svc_cfg ON madi_push_settings TO service_role USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY anon_block_cfg ON madi_push_settings FOR ALL TO anon USING (false);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
