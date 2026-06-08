-- ============================================================
-- MADI — 코어 임상 테이블 인덱스 추가 (성능)
-- 최초 작성: 2026-06-08
-- 분류: [HIGH] — 핵심 5개 테이블 인덱스 0개 상태였음
--
-- 목적
--   madi_children / madi_sessions / madi_schedules /
--   madi_assessments / madi_iep_history 는 모두
--   { id text PK, center_id text, data jsonb } 제네릭 구조이며
--   인덱스가 PK(id) 외에 하나도 없다(2026-06 DB 감사 확인).
--   실제 로드 쿼리는 항상 center_id 로 스코프되고, 날짜·아동으로
--   추가 필터되므로 아래 인덱스가 시퀀셜 스캔을 제거한다.
--
-- ⚠️ 비파괴적 / 멱등
--   · 모든 인덱스 IF NOT EXISTS — 재실행 안전.
--   · 데이터·정책·동작 불변. 읽기 성능만 개선.
--
-- ⚠️ CONCURRENTLY 사용법 (운영 DB 잠금 회피)
--   · CREATE INDEX CONCURRENTLY 는 ★트랜잭션 블록 밖에서★ 한 줄씩
--     실행해야 한다. Supabase SQL Editor 에서 전체를 한 번에 Run 하면
--     암묵적 트랜잭션으로 묶여 "CREATE INDEX CONCURRENTLY cannot run
--     inside a transaction block" 오류가 난다.
--   · 운영(행 다수, 특히 madi_schedules 1700+행)에서는:
--       1) 아래 각 CREATE INDEX 문을 ★하나씩 따로★ 복사해 Run.
--       2) 또는 psql 에서 `\i` 없이 개별 실행.
--   · 신규/소규모 환경이면 CONCURRENTLY 를 빼고 통째로 Run 해도 무방
--     (짧은 ACCESS EXCLUSIVE 잠금이지만 행이 적어 순간).
--   · 표현식 인덱스는 PostgREST 필터(data->>'date', data->>'childId')와
--     ★동형★이어야 옵티마이저가 사용한다. 아래 표현식은 api/index.ts
--     및 madi-app.js 의 실제 쿼리에서 그대로 추출했다.
--
-- 근거가 된 실제 쿼리(추출 출처)
--   · 교사/관리자 로드 (madi-app.js):
--       madi_sessions?  center_id=eq.X & data->>date=gte.Y & order=id.asc
--       madi_schedules? center_id=eq.X & data->>date=gte.Y & order=id.asc
--       madi_assessments? center_id=eq.X & order=id.asc
--       madi_iep_history? center_id=eq.X & order=id.desc
--       madi_children?  center_id=eq.X & order=id.asc
--   · 학부모 격리 READ (supabase/functions/api/index.ts):
--       madi_children:  center_id=eq.X & id=in.(...)
--       madi_sessions / madi_schedules / madi_assessments / madi_iep_history:
--                       center_id=eq.X & data->>childId=in.(...)
--       (※ schedules 는 실 child_id 컬럼도 있으나, 라이브 API 는
--          data->>childId 로 필터하므로 인덱스도 그 표현식에 맞춘다.)
-- ============================================================


-- ─────────────────────────────────────────────────────────────
-- 1. madi_children
--    필터: center_id=eq.X (+ id=in 은 PK 가 처리)
--    정렬: order=id.asc → PK 인덱스가 커버
-- ─────────────────────────────────────────────────────────────
-- 의도: 센터별 아동 전체 로드 시 center_id 시퀀셜 스캔 제거.
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_children_center
  ON madi_children (center_id);


-- ─────────────────────────────────────────────────────────────
-- 2. madi_sessions
--    필터 A(교사/관리자): center_id + data->>'date' 범위
--    필터 B(학부모 격리): center_id + data->>'childId' in
-- ─────────────────────────────────────────────────────────────
-- 의도: 최근 90일 세션 로드(center_id + date 범위)를 인덱스 스캔으로.
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_sessions_center_date
  ON madi_sessions (center_id, (data->>'date'));
-- 의도: 학부모 포털의 자녀별 세션 격리 조회(center_id + childId in).
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_sessions_center_child
  ON madi_sessions (center_id, (data->>'childId'));


-- ─────────────────────────────────────────────────────────────
-- 3. madi_schedules  (행 수 최다 — 1700+행 재발버그 테이블)
--    필터 A(교사/관리자): center_id + data->>'date' 범위
--    필터 B(학부모 격리): center_id + data->>'childId' in (라이브 API 기준)
-- ─────────────────────────────────────────────────────────────
-- 의도: 캘린더/일정 로드(center_id + date 범위) 시퀀셜 스캔 제거.
--       offset 페이지네이션의 페이지 경계 안정화에도 기여.
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_schedules_center_date
  ON madi_schedules (center_id, (data->>'date'));
-- 의도: 학부모 자녀별 일정 격리 조회(center_id + childId in).
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_schedules_center_child
  ON madi_schedules (center_id, (data->>'childId'));


-- ─────────────────────────────────────────────────────────────
-- 4. madi_assessments
--    필터 A(교사/관리자): center_id (+ order=id) — date 필터는 현재 미사용
--    필터 B(학부모 격리): center_id + data->>'childId' in
-- ─────────────────────────────────────────────────────────────
-- 의도: 센터별 평가 전체 로드 시 center_id 스캔 제거.
--       (현재 로드 쿼리에 date 범위는 없으나, 다른 임상 테이블과의
--        일관성·향후 date 필터 대비로 date 표현식도 포함.)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_assessments_center_date
  ON madi_assessments (center_id, (data->>'date'));
-- 의도: 학부모 자녀별 평가 격리 조회(center_id + childId in).
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_assessments_center_child
  ON madi_assessments (center_id, (data->>'childId'));


-- ─────────────────────────────────────────────────────────────
-- 5. madi_iep_history
--    필터 A(교사/관리자): center_id (+ order=id.desc) — date 필터 현재 미사용
--    필터 B(학부모 격리): center_id + data->>'childId' in
-- ─────────────────────────────────────────────────────────────
-- 의도: 센터별 IEP 이력 전체 로드 시 center_id 스캔 제거.
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_iep_history_center_date
  ON madi_iep_history (center_id, (data->>'date'));
-- 의도: 학부모 자녀별 IEP 이력 격리 조회(center_id + childId in).
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_iep_history_center_child
  ON madi_iep_history (center_id, (data->>'childId'));


-- ============================================================
-- 검증 (적용 후 실행)
-- ============================================================
-- 1) 인덱스 생성 확인:
--    SELECT indexname, indexdef FROM pg_indexes
--    WHERE schemaname='public'
--      AND tablename IN ('madi_children','madi_sessions','madi_schedules',
--                        'madi_assessments','madi_iep_history')
--    ORDER BY tablename, indexname;
--
-- 2) 표현식 인덱스가 실제 사용되는지(시퀀셜 스캔 사라졌는지):
--    EXPLAIN ANALYZE
--    SELECT id,data FROM madi_sessions
--    WHERE center_id = '<실제센터id>' AND (data->>'date') >= '2026-03-01'
--    ORDER BY id ASC;
--    → 'Index Scan using idx_sessions_center_date' 가 보이면 정상.
--      'Seq Scan' 이면 표현식 동형 여부/통계(ANALYZE) 재확인.
--
-- 3) CONCURRENTLY 가 중간 실패하면 INVALID 인덱스가 남을 수 있음:
--    SELECT * FROM pg_index i JOIN pg_class c ON c.oid=i.indexrelid
--    WHERE NOT indisvalid;
--    → 있으면 DROP INDEX <name>; 후 해당 줄만 재실행.
-- ============================================================
