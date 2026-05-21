-- ═══════════════════════════════════════════════════════════
-- 마디 앱 — 앱 내 알림 카드 시스템
-- 실행 위치: Supabase Dashboard > SQL Editor
-- ═══════════════════════════════════════════════════════════

-- ─── 1. 알림 테이블 생성 ───
create table if not exists madi_notifications (
  id           bigserial primary key,
  user_id      uuid not null,                    -- 수신자 (madi_users.id)
  center_id    text,                             -- 어느 센터의 알림인지
  type         text not null,                    -- 'notice'|'session'|'report'|'system'
  title        text not null,                    -- 알림 제목
  body         text,                             -- 본문 (선택)
  link         text,                             -- 클릭 시 이동 (예: 'notice/123')
  read_at      timestamptz,                      -- 읽은 시각 (null = 미확인)
  created_at   timestamptz default now()
);

-- ─── 2. 인덱스 (성능 최적화) ───
-- 미확인 알림 조회 빠르게
create index if not exists idx_notif_user_unread 
  on madi_notifications(user_id, read_at);

-- 시간순 정렬 빠르게
create index if not exists idx_notif_user_created 
  on madi_notifications(user_id, created_at desc);

-- ─── 3. RLS (Row Level Security) ───
-- Edge Function이 service_role_key로 호출하므로 RLS는 안전망 역할
alter table madi_notifications enable row level security;

-- 본인의 알림만 읽기/수정 가능 (Edge Function 우회 시 안전망)
drop policy if exists "users read own notifications" on madi_notifications;
create policy "users read own notifications"
  on madi_notifications for select
  using (auth.uid() = user_id);

drop policy if exists "users update own notifications" on madi_notifications;
create policy "users update own notifications"
  on madi_notifications for update
  using (auth.uid() = user_id);

-- ─── 4. 알림 자동 청소 (선택, 30일 이상된 읽은 알림 삭제) ───
-- 매일 자정 자동 실행하려면 pg_cron 확장 필요. 일단 함수만 정의.
create or replace function cleanup_old_notifications()
returns void as $$
begin
  delete from madi_notifications
  where read_at is not null
    and read_at < now() - interval '30 days';
end;
$$ language plpgsql;

-- ═══════════════════════════════════════════════════════════
-- 검증 쿼리 (실행 후 확인용)
-- ═══════════════════════════════════════════════════════════
-- 테이블 생성 확인
-- select column_name, data_type from information_schema.columns 
--   where table_name = 'madi_notifications';

-- 인덱스 확인
-- select indexname from pg_indexes where tablename = 'madi_notifications';

-- 정책 확인
-- select polname from pg_policy where polrelid = 'madi_notifications'::regclass;
