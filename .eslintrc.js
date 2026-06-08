/* eslint-disable */
// 아이마디아이 ESLint 설정
// 목적:
//   1) innerHTML XSS 패턴을 커밋 전에 자동 차단
//   2) 잉여 코드(미사용 지역 변수) 누적 차단
// 핵심 규칙:
//   - no-unsanitized: escHtml() 래핑 없이 innerHTML 직접 삽입 차단
//   - no-unused-vars: 미사용 지역 변수 누적 차단 (의도적 미사용은 _prefix)

module.exports = {
  env: {
    browser: true,
    es2015: true,
  },

  // 프로젝트 전역 변수 (no-undef 오탐 방지)
  globals: {
    // ── Core (madi-01*.js) ──────────────────────────
    supaFetch: 'readonly',
    supaCache: 'readonly',
    escHtml: 'readonly',
    escJs: 'readonly',
    jsArg: 'readonly',
    showToast: 'readonly',
    canDo: 'readonly',
    SUPA_URL: 'readonly',
    ANON_KEY: 'readonly',
    currentUser: 'writable',
    centerSettings: 'writable',
    // ── DB 전역 배열 ────────────────────────────────
    childDB: 'writable',
    sessionDB: 'writable',
    scheduleDB: 'writable',
    assessmentDB: 'writable',
    iepDB: 'writable',
    activitiesDB: 'writable',
    notifDB: 'writable',
    staffDB: 'writable',
    // ── 주요 함수 ───────────────────────────────────
    doLogin: 'readonly',
    doLogout: 'readonly',
    applyRoleUI: 'readonly',
    loadDBFromSupabase: 'readonly',
    initRealtime: 'readonly',
    stopRealtime: 'readonly',
    renderChildGrid: 'readonly',
    switchTab: 'readonly',
    showSection: 'readonly',
    // ── 외부 라이브러리 ─────────────────────────────
    Chart: 'readonly',
    XLSX: 'readonly',
    supabase: 'readonly',
  },

  plugins: ['no-unsanitized'],

  rules: {
    // ── [ERROR] XSS 방어 — 커밋 차단 ─────────────────
    // innerHTML / outerHTML 등 DOM property 에 escHtml() 없이 변수 삽입 금지
    'no-unsanitized/property': [
      'error',
      {
        escape: {
          // escHtml()·jsArg()(=escHtml∘escJs, 인라인 핸들러 인자용)로 래핑된 값은 안전하다고 간주
          methods: ['escHtml', 'jsArg'],
        },
      },
    ],
    // insertAdjacentHTML() 등 DOM method 에 escHtml() 없이 변수 삽입 금지
    'no-unsanitized/method': [
      'error',
      {
        escape: {
          methods: ['escHtml', 'jsArg'],
        },
      },
    ],

    // ── [WARN] 잉여 코드 누적 차단 — package.json 의 --max-warnings=0 과 결합되어 커밋 차단 ──
    // 의도적 미사용 변수는 _prefix 사용 (예: function foo(_unused) {})
    // — 이미 코드베이스에 _unusedSessions 패턴 존재 (madi-15.js)
    'no-unused-vars': [
      'warn',
      {
        args: 'none',                  // 함수 인자 미사용은 검사 안 함 (콜백 패턴 다수)
        vars: 'local',                 // 전역 변수는 globals 항목으로 별도 관리
        caughtErrors: 'none',          // catch (e) { /* silent */ } 패턴 허용
        varsIgnorePattern: '^_',       // _NL, _unused 등 underscore prefix 무시
      },
    ],

    // ── [ERROR] ES 타겟·컨벤션 강제 — 구형 iOS Safari 화이트스크린/컨벤션 이탈 차단 ──
    //   var/function/.then 일관 사용 원칙(CLAUDE.md). ?./??/async 는 es2015 파서가 파싱에러로
    //   이미 차단하므로, 여기서는 ES6 로 합법이라 새어들 수 있는 arrow/let/const/class/.finally 를 막는다.
    'no-restricted-syntax': [
      'error',
      { selector: 'ArrowFunctionExpression', message: '컨벤션: arrow function(=>) 금지 — function 사용' },
      { selector: "VariableDeclaration[kind='let']", message: '컨벤션: let 금지 — var 사용' },
      { selector: "VariableDeclaration[kind='const']", message: '컨벤션: const 금지 — var 사용' },
      { selector: 'ClassDeclaration', message: '컨벤션: class 금지 — function/prototype 사용' },
      { selector: 'ClassExpression', message: '컨벤션: class 금지 — function/prototype 사용' },
      { selector: "CallExpression[callee.property.name='finally']", message: '구형 iOS Safari 미지원: Promise.finally 금지 — then/catch 양쪽에서 리셋' },
    ],
  },

  // 검사 제외 경로
  ignorePatterns: [
    'node_modules/',
    'supabase/',   // TypeScript Edge Functions — 별도 tsc로 검사
    'tests/',
    'sw.js',       // Service Worker — 별도 환경
    '*.min.js',
  ],
};
