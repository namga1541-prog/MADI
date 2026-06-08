-- ============================================================
-- MADI — 코어 임상 5개 테이블 DDL (★추정본★)
-- 최초 작성: 2026-06-08
-- 분류: [HIGH] — 레포에 코어 테이블 CREATE 정의가 없어 신규 환경
--                재현 불가. 신규 셋업용 0순위 후보.
--
-- ⚠️⚠️⚠️ 경고: 이 파일은 ★추정본★ 이다 ⚠️⚠️⚠️
--   · 실DB 접근(pg_dump) 없이, SCHEMA.md 기재와 코드 사용 패턴만으로
--     역설계한 정의다. 컬럼 타입·NOT NULL·DEFAULT·제약은 ★보장 불가★.
--   · ★실DB 에서 반드시 검증·교체할 것★:
--       supabase db dump --schema-only \
--         --project-ref ujxdhafzjyrglaclarwe > schema_real.sql
--       (또는 psql:  pg_dump --schema-only -t 'madi_children' ... )
--     로 실제 DDL 을 받아 이 파일을 ★실측본으로 교체★해야 한다.
--   · 운영 DB 에는 이미 이 테이블들이 존재하므로 IF NOT EXISTS 가
--     no-op 이 되어 ★기존 데이터/스키마를 덮어쓰지 않는다★(안전).
--     단, 신규 빈 환경에 적용할 때만 실제로 생성되며, 그 경우
--     실DB 와 미세 차이(타입 등)가 날 수 있으니 위 검증 후 사용.
--
-- 근거
--   · SCHEMA.md: "공통 컬럼 id(text PK), center_id(text), data(JSONB)"
--   · madi_schedules 는 추가 실컬럼 child_id 보유(SCHEMA.md).
--   · 인덱스는 별도 파일 add_core_indexes.sql 에서 생성(여기 미포함).
--   · RLS 활성화/차단정책은 rls_core_tables.sql 에서 처리(여기 미포함).
-- ============================================================


-- ─────────────────────────────────────────────────────────────
-- 1. madi_children — 아동 정보
--    (추정) id text PK, center_id text, data jsonb
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS madi_children (
  id         text PRIMARY KEY,
  center_id  text,
  data       jsonb NOT NULL DEFAULT '{}'::jsonb
);


-- ─────────────────────────────────────────────────────────────
-- 2. madi_sessions — 세션 기록
--    (추정) data->>'date', data->>'childId' 를 쿼리에서 사용
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS madi_sessions (
  id         text PRIMARY KEY,
  center_id  text,
  data       jsonb NOT NULL DEFAULT '{}'::jsonb
);


-- ─────────────────────────────────────────────────────────────
-- 3. madi_schedules — 스케줄·캘린더
--    (추정) child_id 가 실 컬럼으로 존재(SCHEMA.md). 단 라이브
--    학부모 격리 API 는 data->>'childId' 로 필터함(둘 다 존재 가능).
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS madi_schedules (
  id         text PRIMARY KEY,
  center_id  text,
  child_id   text,                              -- 실 컬럼 (SCHEMA.md 근거)
  data       jsonb NOT NULL DEFAULT '{}'::jsonb
);


-- ─────────────────────────────────────────────────────────────
-- 4. madi_assessments — 표준화검사
--    (추정) user_id 실 컬럼 존재 가능(SCHEMA.md: "madi_assessments.user_id",
--    assessments_user_id_migration.sql 로 추가). 안전상 추가해 둠.
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS madi_assessments (
  id         text PRIMARY KEY,
  center_id  text,
  user_id    text,                              -- assessments_user_id_migration.sql 근거
  data       jsonb NOT NULL DEFAULT '{}'::jsonb
);


-- ─────────────────────────────────────────────────────────────
-- 5. madi_iep_history — IEP 기록
--    (추정) id text PK, center_id text, data jsonb
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS madi_iep_history (
  id         text PRIMARY KEY,
  center_id  text,
  data       jsonb NOT NULL DEFAULT '{}'::jsonb
);


-- ============================================================
-- 후속(권장 순서)
--   1) add_core_indexes.sql      — 인덱스 생성
--   2) rls_core_tables.sql       — RLS 활성화 + 차단정책
-- ============================================================
-- 검증
--   SELECT table_name, column_name, data_type, is_nullable, column_default
--   FROM information_schema.columns
--   WHERE table_schema='public'
--     AND table_name IN ('madi_children','madi_sessions','madi_schedules',
--                        'madi_assessments','madi_iep_history')
--   ORDER BY table_name, ordinal_position;
--   → 실DB 결과와 이 추정본을 대조해 차이가 있으면 실측본으로 교체.
-- ============================================================
