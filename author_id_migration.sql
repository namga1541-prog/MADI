-- ══════════════════════════════════════════════════════════════════════
-- author_id 마이그레이션 SQL
-- 목적: madi_lounge_posts / madi_lounge_comments 의 과거 데이터(author_id=NULL)에
--       madi_users.id 를 채워 author_name 동명이인 fallback을 제거 가능하게 함
--
-- 실행 방법: Supabase 대시보드 > SQL Editor에 붙여넣고 실행
-- 주의: 실행 전 백업 권장 (SELECT * FROM madi_lounge_posts 로 확인)
-- ══════════════════════════════════════════════════════════════════════

-- ── 1. madi_lounge_posts: author_id NULL인 행을 author_name으로 매칭 ──────
UPDATE madi_lounge_posts p
SET    author_id = u.id::text
FROM   madi_users u
WHERE  p.author_id IS NULL
  AND  p.author_name IS NOT NULL
  AND  p.author_name = u.name
  AND  (p.center_id IS NULL OR p.center_id = u.center_id);

-- 확인: 여전히 author_id가 NULL인 행 (동명이인으로 모호해서 채우지 못한 경우)
-- SELECT id, author_name, center_id FROM madi_lounge_posts WHERE author_id IS NULL;

-- ── 2. madi_lounge_comments: 같은 방식으로 처리 ──────────────────────────
UPDATE madi_lounge_comments c
SET    author_id = u.id::text
FROM   madi_users u
WHERE  c.author_id IS NULL
  AND  c.author_name IS NOT NULL
  AND  c.author_name = u.name;

-- 확인
-- SELECT id, author_name FROM madi_lounge_comments WHERE author_id IS NULL;

-- ── 3. 마이그레이션 후 클라이언트 코드에서 author_name fallback 제거 ────────
-- 아래 파일들의 fallback 패턴을 제거해야 함:
-- madi-14.js filterLoungePosts(): p.author_name === name → 제거
-- madi-14.js renderLoungeUI(): p.author_name !== user.name → 제거
-- madi-14.js renderInquiryCard(): post.author_name === user.name → 제거
-- madi-14.js renderComments(): c.author_name === user.name → 제거
-- (모두 author_id 기반으로만 판단하도록 변경)
