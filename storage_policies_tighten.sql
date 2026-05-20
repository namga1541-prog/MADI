-- ══════════════════════════════════════════════════════════════════════
-- Storage 정책 강화 (C1)
-- 목적: board-images bucket 의 anon 권한이 INSERT/DELETE/SELECT 모두 허용된
--       상태를 정리. 업로드는 upload-image Edge Function 의 service_role 만
--       수행하도록 강제. SELECT 만 public 유지 (라운지 이미지 표시용).
-- ══════════════════════════════════════════════════════════════════════

-- ── anon 권한의 INSERT/DELETE/SELECT 정책 삭제 ───────────────────────
DROP POLICY IF EXISTS "board_images_anon_insert" ON storage.objects;
DROP POLICY IF EXISTS "board_images_anon_delete" ON storage.objects;
DROP POLICY IF EXISTS "board_images_anon_select" ON storage.objects;

-- ── INSERT/DELETE 가 anon 으로 차단되는지 확실히 하는 sentinel 유지 ──
-- (board_images_no_anon_write INSERT WITH CHECK = false 이미 존재. 그대로 둠)
-- 명시적 DELETE 차단 정책 추가:
DROP POLICY IF EXISTS "board_images_no_anon_delete" ON storage.objects;
CREATE POLICY "board_images_no_anon_delete" ON storage.objects FOR DELETE
TO anon, authenticated
USING (false);

-- ── SELECT 는 public 유지 (라운지 이미지 표시) ───────────────────────
-- 의도된 공개: 이미지 URL 은 UUID 기반이라 추측 불가, 학부모도 RLS 로 라운지 차단됨.
-- 만약 향후 학부모에게도 글이 보이는 정책이 추가되면 이 정책도 좁혀야 함.
-- 현재 board_images_public_read 정책 그대로 유지.

-- ── 확인 쿼리 ──────────────────────────────────────────────────────────
-- SELECT policyname, cmd, roles, qual, with_check FROM pg_policies
-- WHERE schemaname='storage' AND tablename='objects' AND policyname LIKE 'board_images%';
