-- ════════════════════════════════════════════════════════════════════
-- 로그인 업데이트 팝업 — madi_global_notices 확장
-- ════════════════════════════════════════════════════════════════════
-- 슈퍼어드민이 작성한 마디 공지사항 중 1개를 "로그인 직후 팝업"으로 지정.
-- 한 번에 단 1개만 활성 가능 (partial unique index 로 강제).
-- ════════════════════════════════════════════════════════════════════

alter table madi_global_notices
  add column if not exists show_as_login_popup boolean not null default false;

-- 활성 글 1개만 허용: show_as_login_popup = true 인 row 중에서
-- (show_as_login_popup) 값이 unique → true 인 row 가 2개 이상이면 위반.
create unique index if not exists madi_global_notices_one_popup_idx
  on madi_global_notices ((show_as_login_popup))
  where show_as_login_popup = true;

-- 팝업 글 빠른 조회용 부분 인덱스
create index if not exists madi_global_notices_popup_lookup_idx
  on madi_global_notices (created_at desc)
  where show_as_login_popup = true;

-- 검증: 컬럼·인덱스 확인
select
  column_name, data_type, column_default, is_nullable
from information_schema.columns
where table_name = 'madi_global_notices'
  and column_name = 'show_as_login_popup';
