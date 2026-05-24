-- ============================================================
-- prog_types 컬럼 추가 — madi_users 테이블
-- ============================================================
-- 목적: 선생님별 담당 프로그램 유형 저장 (admin.html 교사관리 기능)
-- 형식: JSONB 배열, 예) ["언어치료", "감각통합", "인지학습"]
-- 멱등: IF NOT EXISTS 패턴, 재실행 안전
-- 실행: Supabase Dashboard → SQL Editor → 전체 붙여넣기 → Run
-- ============================================================

ALTER TABLE madi_users
  ADD COLUMN IF NOT EXISTS prog_types JSONB DEFAULT '[]'::jsonb;

-- 기존 행에 빈 배열 백필 (NULL 방어)
UPDATE madi_users
SET    prog_types = '[]'::jsonb
WHERE  prog_types IS NULL;

-- 검증 쿼리
SELECT id, username, role, prog_types
FROM   madi_users
LIMIT  5;
