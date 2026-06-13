-- ============================================================
-- MADI — madi_settings.api_key 평문 LLM 키 제거 [보안, 1회성 데이터 정리]
-- ------------------------------------------------------------
-- 배경: ai-proxy 가 더 이상 madi_settings.api_key 를 읽지 않는다
--   (ANTHROPIC_API_KEY Edge secret = 마디 통합 키 사용, 2026-06-13).
--   테넌트(admin) 읽기 가능 테이블에 남은 평문 sk-ant 키 노출면을 제거한다.
-- 적용: Supabase Dashboard > SQL Editor 에서 실행 (MIGRATIONS_RUNBOOK 방식).
-- 멱등: 행이 없거나 이미 비어 있으면 영향 0건(안전). 재실행 가능.
-- 검증: 실행 후 tests/live-probe.js 의 P9 가 '평문 키 없음' 으로 나오면 완료.
-- ------------------------------------------------------------
-- value 를 NULL 로 비운다(행 구조 보존, NOT NULL 제약 시 빈 문자열로 대체).
UPDATE madi_settings
   SET value = ''
 WHERE key = 'api_key'
   AND COALESCE(value, '') <> '';

-- (대안: 행 자체를 제거하려면 위 UPDATE 대신 아래를 사용)
-- DELETE FROM madi_settings WHERE key = 'api_key';
