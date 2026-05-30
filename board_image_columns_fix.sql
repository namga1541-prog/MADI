-- ══════════════════════════════════════════════════════════════════════
-- 게시판/자료실 이미지·메타 컬럼 보강 (2026-05-30)
-- 문제: madi_lounge_posts 에 'images' 컬럼이 없어 자료실(자료 등록)이 100% 실패
--       (PGRST204: Could not find the 'images' column). 라운지 글 첨부(image_urls)·
--       댓글 첨부(image_url)·카테고리(note)·작성자역할(author_role) 컬럼도 함께 보강.
-- 동작: 전부 ADD COLUMN IF NOT EXISTS — 이미 있으면 무변화(멱등·재실행 안전).
-- 컬럼 타입 = 클라이언트 전송 형태에 맞춤:
--   · images      text  : 자료실이 JSON.stringify(urls) 문자열로 전송
--   · image_urls  jsonb : 라운지 글이 배열로 전송
--   · image_url   text  : 댓글이 단일 URL 문자열로 전송
-- ══════════════════════════════════════════════════════════════════════

-- ── madi_lounge_posts (라운지 글 + 자료실 resource) ──
ALTER TABLE madi_lounge_posts    ADD COLUMN IF NOT EXISTS images      text;
ALTER TABLE madi_lounge_posts    ADD COLUMN IF NOT EXISTS image_urls  jsonb DEFAULT '[]'::jsonb;
ALTER TABLE madi_lounge_posts    ADD COLUMN IF NOT EXISTS note        text;
ALTER TABLE madi_lounge_posts    ADD COLUMN IF NOT EXISTS author_role text;

-- ── madi_lounge_comments (댓글) ──
ALTER TABLE madi_lounge_comments ADD COLUMN IF NOT EXISTS image_url   text;
ALTER TABLE madi_lounge_comments ADD COLUMN IF NOT EXISTS author_role text;

-- ── superadmin(센터 미소속)도 자료 등록 가능하도록 center_id NOT NULL 해제 ──
--    (이미 nullable 이면 무변화. null center_id 자료는 현재 읽기 정책상 superadmin 에게만 보임.)
ALTER TABLE madi_lounge_posts    ALTER COLUMN center_id DROP NOT NULL;

-- ── 확인 (선택) ──
-- SELECT column_name, data_type FROM information_schema.columns
-- WHERE table_name = 'madi_lounge_posts' ORDER BY ordinal_position;
