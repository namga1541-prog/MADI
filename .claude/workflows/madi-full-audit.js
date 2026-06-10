export const meta = {
  name: 'madi-full-audit',
  description: '아이마디 APP 전수점검 — 보안·DB·코드·UX·권한 9개 도메인 병렬 감사',
  phases: [
    { title: '사전 스카우트', detail: 'Pre-Scout: 파일 목록·도메인 분류 (haiku)' },
    { title: '병렬 감사', detail: '9개 도메인 동시 점검 (sonnet)' },
    { title: '종합 리포트', detail: '결과 취합·우선순위 분류·개선 로드맵 (opus)' },
  ],
}

// ── 공통 컨텍스트 블록 (모든 에이전트 브리핑에 포함) ──────────────────────
const CTX = `
## 프로젝트 컨텍스트
- 언어치료 센터 관리 웹앱. 빌드 도구 없는 순수 바닐라 JS 정적 사이트.
- 운영 URL: https://namga1541-prog.github.io/MADI/
- 백엔드: Supabase REST API + Edge Functions

## 코딩 컨벤션 (위반 = 결함)
- var/function/.then() 사용 — arrow function·class·let·const 금지
- template literal(백틱) 허용
- 전역 변수: childDB, sessionDB, scheduleDB, assessmentDB 등
- DB 접근: 반드시 supaFetch() 경유 (직접 fetch/XMLHttpRequest 금지)
- 사용자 입력 HTML 삽입 시 반드시 escHtml() 처리
- console.log 운영 코드 추가 금지
- Supabase anon key 소스 하드코딩 금지

## DB 스키마 — 정본은 SCHEMA.md 하나뿐 (여기 표 복붙 금지)
- 컬럼 존재·이름 검증은 반드시 SCHEMA.md 를 Read 해서 대조할 것.
  (과거 이 브리핑의 사본이 정본과 갈라져 actor_name/record_id/status 오기로 오탐을 유발 — 2026-06-10 전수감사에서 적발돼 사본 제거.)
- 함정 2개만 박제: madi_users 에 status 컬럼 없음(POST 주입 시 400) · madi_audit_log 는 actor_role·row_id (actor_name·record_id 아님).

## 역할 체계
- superadmin: 플랫폼 전체 관리자 (username: dinosau)
- admin: 센터장
- teacher: 선생님
- parent: 학부모

## 파일 목록
madi-01.js(공통 유틸), madi-01-auth.js(인증), madi-01-app.js(DB로드·학부모 UI),
madi-02.js(세션기록), madi-03.js(홈·네비), madi-03-dashboard.js(대시보드),
madi-04.js(아동관리), madi-05.js(아동상세), madi-06.js(성장기록), madi-07.js(IEP),
madi-08.js(AI기능), madi-09.js(학부모포털), madi-10.js(스케줄·캘린더),
madi-11.js(표준화검사), madi-12.js(감통평가·권한·PWA·IndexedDB),
madi-12-chat.js(AI비서·음성), madi-13.js(리포트·계획),
madi-14.js(게시판 공지), madi-14-board.js(게시판 라운지·자료실),
madi-15.js(학부모 홈), madi-15-pages.js(학부모 서브페이지),
madi-16.js(빠른기록), madi-vocab.js(임상어휘사전)
`

// ── PHASE 1: 사전 스카우트 ─────────────────────────────────────────────────
phase('사전 스카우트')

const scout = await agent(
  `${CTX}

## 임무: Pre-Scout (분류만, 수정 없음)
프로젝트 루트의 madi-*.js, index.html, admin.html, sw.js 파일들을 읽고
아래 JSON 형식으로 도메인별 파일 배정표를 반환하라.
각 도메인에 담당 파일 목록을 배정한다 (중복 허용).

{
  "security": ["..."],
  "db_schema": ["..."],
  "convention": ["..."],
  "role_auth": ["..."],
  "error_handling": ["..."],
  "performance": ["..."],
  "ui_ux": ["..."],
  "edge_function": ["..."],
  "pwa_sw": ["..."],
  "summary": "파일 수, 총 라인 수 추정, 주요 특이사항"
}`,
  { label: 'pre-scout', phase: '사전 스카우트', model: 'haiku' }
)

log('Pre-Scout 완료 → 9개 도메인 병렬 감사 시작')

// ── PHASE 2: 9개 도메인 병렬 감사 ─────────────────────────────────────────
phase('병렬 감사')

const FINDING_SCHEMA = {
  type: 'object',
  required: ['domain', 'severity_counts', 'findings'],
  properties: {
    domain: { type: 'string' },
    severity_counts: {
      type: 'object',
      properties: {
        critical: { type: 'number' },
        high: { type: 'number' },
        medium: { type: 'number' },
        low: { type: 'number' },
        info: { type: 'number' }
      }
    },
    findings: {
      type: 'array',
      items: {
        type: 'object',
        required: ['severity', 'file', 'description', 'recommendation'],
        properties: {
          severity: { type: 'string', enum: ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'INFO'] },
          file: { type: 'string' },
          line_hint: { type: 'string' },
          description: { type: 'string' },
          recommendation: { type: 'string' }
        }
      }
    }
  }
}

const domainResults = await parallel([

  // ① 보안 감사
  () => agent(
    `${CTX}

## 임무: 보안 감사 (Security Audit)
담당 파일: 전체 madi-*.js, index.html, admin.html

점검 항목:
1. innerHTML/outerHTML/insertAdjacentHTML에 escHtml() 미적용 여부 (XSS)
2. eval(), new Function(), setTimeout(string) 사용 여부
3. Supabase anon key 또는 JWT secret 하드코딩 여부
4. 직접 fetch() 또는 XMLHttpRequest로 Supabase 호출 (supaFetch 우회)
5. URL 파라미터·사용자 입력을 SQL 쿼리에 직접 삽입 여부 (인젝션)
6. postMessage 수신 시 origin 검증 없는 경우
7. 민감정보(비밀번호, 토큰)가 localStorage에 평문 저장되는 경우
8. 클라이언트 측 역할 검증만으로 접근 제한하는 경우 (서버 RLS 없이)

각 발견사항마다 파일명, 심각도(CRITICAL/HIGH/MEDIUM/LOW/INFO), 설명, 권고사항을 기록.`,
    { label: '보안 감사', phase: '병렬 감사', schema: FINDING_SCHEMA }
  ),

  // ② DB 스키마 일관성
  () => agent(
    `${CTX}

## 임무: DB 스키마 일관성 점검
담당 파일: 전체 madi-*.js (supaFetch 호출 위주)

점검 항목:
1. supaFetch() 또는 URL 쿼리에서 select= 파라미터로 참조하는 컬럼이
   위 스키마 목록에 없는 컬럼인지 확인
2. INSERT/PATCH/POST 바디에서 존재하지 않는 컬럼을 포함하는 경우
3. madi_settings 테이블에 center_id로 필터링하는 코드 (해당 컬럼 없음)
4. 테이블명 오타 (madi_ 접두사 누락 등)
5. 조인 시 잘못된 참조 컬럼 사용
6. 컬럼 타입 불일치 (prog_types는 JSONB — 문자열로 다루면 버그)

각 발견사항마다 파일명, 심각도, 잘못된 컬럼명, 올바른 컬럼명, 권고사항 기록.`,
    { label: 'DB 스키마 일관성', phase: '병렬 감사', schema: FINDING_SCHEMA }
  ),

  // ③ 코딩 컨벤션
  () => agent(
    `${CTX}

## 임무: 코딩 컨벤션 점검
담당 파일: 전체 madi-*.js

점검 항목:
1. arrow function 사용 (()=>, (x)=>) — 컨벤션 위반
2. class 키워드 사용
3. let / const 사용 (var만 허용)
4. async/await 사용 (.then() 체인이 원칙)
5. console.log / console.error / console.warn 운영 코드에 잔존
6. HTML ID가 camelCase가 아닌 경우 (kebab-case 등)
7. 하드코딩된 Supabase URL 또는 key 문자열
8. 미사용 전역 변수 또는 함수 선언
9. 중복 함수 정의 (같은 이름 함수가 여러 파일에)

각 발견사항마다 파일명, 심각도, 설명, 권고사항 기록.`,
    { label: '코딩 컨벤션', phase: '병렬 감사', schema: FINDING_SCHEMA }
  ),

  // ④ 역할·권한 분기
  () => agent(
    `${CTX}

## 임무: 역할·권한 분기 점검
담당 파일: 전체 madi-*.js, index.html, admin.html

점검 항목:
1. superadmin/admin/teacher/parent 분기가 필요한 곳에서 분기 누락
2. 역할 분기 순서 오류 (superadmin을 먼저 체크하지 않는 경우)
3. currentUser.role 대신 username === 'dinosau' 같은 우회 로직
4. parent 역할이 teacher/admin 전용 기능에 접근 가능한 경우
5. teacher가 다른 센터의 아동 데이터에 접근 가능한 경우 (center_id 필터 누락)
6. admin.html이 admin/superadmin 이외 역할에서 접근 가능한 경우
7. permissions JSONB 체크가 불완전한 경우

각 발견사항마다 파일명, 심각도, 설명, 권고사항 기록.`,
    { label: '역할·권한 분기', phase: '병렬 감사', schema: FINDING_SCHEMA }
  ),

  // ⑤ 에러 핸들링
  () => agent(
    `${CTX}

## 임무: 에러 핸들링 점검
담당 파일: 전체 madi-*.js

점검 항목:
1. supaFetch() 호출 후 .catch() 없는 경우 (unhandled rejection)
2. Promise 체인에서 에러가 무시되는 경우 (.catch(function(){}) 빈 블록)
3. showToast() 없이 에러가 묵살되는 경우
4. 사용자에게 기술적 에러 메시지(스택트레이스 등) 그대로 노출
5. try-catch 없이 JSON.parse() 사용
6. null/undefined 체크 없이 객체 프로퍼티 접근 (잠재적 TypeError)
7. 비동기 함수 호출 후 반환값을 기다리지 않는 경우 (fire-and-forget 의도 아닌 경우)
8. 네트워크 오류 시 UI가 로딩 상태로 멈추는 패턴

각 발견사항마다 파일명, 심각도, 설명, 권고사항 기록.`,
    { label: '에러 핸들링', phase: '병렬 감사', schema: FINDING_SCHEMA }
  ),

  // ⑥ 성능·중복
  () => agent(
    `${CTX}

## 임무: 성능·중복 점검
담당 파일: madi-01.js(supaCache), madi-01-app.js, madi-03.js, madi-04.js, madi-05.js, madi-10.js

점검 항목:
1. supaCache를 사용해야 하는 반복 호출에서 캐시 미사용
2. 동일 데이터를 여러 곳에서 중복 fetch하는 경우
3. 화면 렌더 시 불필요한 전체 재렌더 (diff 없이 innerHTML 전체 교체)
4. 이벤트 리스너가 중복 등록되는 패턴 (removeEventListener 없이 재등록)
5. 대용량 배열을 필터링 없이 전부 DOM에 렌더하는 경우 (가상화 미적용)
6. setInterval / setTimeout 정리(clearInterval) 없이 중복 생성
7. 동기적으로 실행되어 UI를 블록하는 무거운 연산

각 발견사항마다 파일명, 심각도, 설명, 권고사항 기록.`,
    { label: '성능·중복', phase: '병렬 감사', schema: FINDING_SCHEMA }
  ),

  // ⑦ UI·UX
  () => agent(
    `${CTX}

## 임무: UI·UX 점검
담당 파일: index.html, admin.html, madi.css, madi-03-dashboard.js, madi-15.js, madi-15-pages.js, madi-16.js

점검 항목:
1. 다크모드(dark class) 미지원 컴포넌트 (배경·텍스트 색상 하드코딩)
2. 모바일(360px 이하) 깨지는 레이아웃 패턴
3. 학부모 포털(parent role)에서 교사 전용 UI 요소가 노출되는 경우
4. 빠른기록 모드(madi-16.js) 모바일 터치 타겟 48px 미만
5. 접근성: aria-label 없는 버튼·아이콘, alt 없는 이미지
6. 로딩 스피너 없이 비동기 작업이 진행되는 경우
7. showToast 메시지가 너무 짧아 읽기 어려운 경우 (기본 3초 미만)
8. 대시보드 역할별 렌더 분기(Teacher/Admin)가 빠진 케이스

각 발견사항마다 파일명, 심각도, 설명, 권고사항 기록.`,
    { label: 'UI·UX', phase: '병렬 감사', schema: FINDING_SCHEMA }
  ),

  // ⑧ Edge Function
  () => agent(
    `${CTX}

## 임무: Edge Function 점검
담당 파일: supabase/functions/ 디렉토리 전체, madi-01.js (EDGE_URL 상수)

점검 항목:
1. 각 Edge Function의 CORS 헤더 설정 (Access-Control-Allow-Origin)
2. --no-verify-jwt 없이 배포된 Function (모든 요청이 401이 됨)
3. JWT 검증을 수행해야 하는 Function에서 검증 누락
4. Edge Function에서 DB 접근 시 service_role key 대신 anon key 사용
5. rate limiting 미적용 Function (madi_rate_limits 테이블 미사용)
6. 에러 응답 시 민감한 내부 정보 노출
7. input validation 미적용 (파라미터 검증 없이 DB 쿼리 실행)
8. EDGE_URL 상수가 올바른 Supabase 프로젝트 URL인지

각 발견사항마다 파일명/함수명, 심각도, 설명, 권고사항 기록.`,
    { label: 'Edge Function', phase: '병렬 감사', schema: FINDING_SCHEMA }
  ),

  // ⑨ PWA·Service Worker·IndexedDB
  () => agent(
    `${CTX}

## 임무: PWA·Service Worker·IndexedDB 점검
담당 파일: sw.js, madi-12.js, madi-15-pages.js (푸시), index.html (manifest)

점검 항목:
1. sw.js CACHE_VERSION이 파일 변경 시 갱신되는 메커니즘 확인
2. 오프라인 fallback 페이지 존재 여부
3. IndexedDB 트랜잭션 에러 핸들링 (오류 시 rollback)
4. 푸시 알림 구독 데이터(endpoint, p256dh, auth)가 madi_push_subscriptions에 올바르게 저장
5. Service Worker 업데이트 시 사용자에게 새로고침 안내 UI
6. manifest.json의 icon 경로 유효성
7. install/activate 이벤트에서 오래된 캐시 삭제 여부
8. 백그라운드 동기화(Background Sync) 사용 시 실패 처리

각 발견사항마다 파일명, 심각도, 설명, 권고사항 기록.`,
    { label: 'PWA·SW·IndexedDB', phase: '병렬 감사', schema: FINDING_SCHEMA }
  ),

])

const validResults = domainResults.filter(Boolean)
log(`병렬 감사 완료: ${validResults.length}/9 도메인 결과 수집`)

// ── PHASE 3: 종합 리포트 ──────────────────────────────────────────────────
phase('종합 리포트')

const allFindings = validResults.flatMap(function(r) { return r.findings || [] })
const criticalCount = allFindings.filter(function(f) { return f.severity === 'CRITICAL' }).length
const highCount = allFindings.filter(function(f) { return f.severity === 'HIGH' }).length

log(`총 발견사항: ${allFindings.length}건 (CRITICAL: ${criticalCount}, HIGH: ${highCount})`)

const report = await agent(
  `${CTX}

## 임무: 종합 감사 리포트 작성
아래 9개 도메인의 감사 결과를 종합하여 한국어 리포트를 작성한다.

## 입력 데이터
${JSON.stringify(validResults, null, 2)}

## 리포트 형식

# 아이마디 APP 전수점검 결과 리포트

## 전체 요약
- 총 발견사항 수 / 심각도별 분류 표
- 즉시 조치 필요 항목 수

## 1. CRITICAL (즉시 수정 필수)
각 항목: [파일명:라인힌트] 설명 → 권고사항

## 2. HIGH (이번 스프린트 내 수정)
각 항목: [파일명] 설명 → 권고사항

## 3. MEDIUM (다음 스프린트)
항목 목록 (간략)

## 4. LOW / INFO
항목 목록 (간략)

## 도메인별 건강도 점수 (100점 만점)
각 도메인: 점수, 한줄 평가

## 권고 수정 순서 (로드맵)
1순위 → 2순위 → 3순위 (파일명·작업 내용 포함)

## 잘 구현된 부분 (Keep)
긍정적인 패턴 3~5개

리포트는 상세하고 실행 가능한 내용으로 작성한다.`,
  { label: '종합 리포트', phase: '종합 리포트', model: 'opus' }
)

return {
  total_findings: allFindings.length,
  critical: criticalCount,
  high: highCount,
  medium: allFindings.filter(function(f) { return f.severity === 'MEDIUM' }).length,
  low_info: allFindings.filter(function(f) { return f.severity === 'LOW' || f.severity === 'INFO' }).length,
  domain_results: validResults,
  report: report,
}
