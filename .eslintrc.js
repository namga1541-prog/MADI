/* eslint-disable */
// 아이마디아이 ESLint 설정
// 목적: innerHTML XSS 패턴을 커밋 전에 자동 차단
// 핵심 규칙: no-unsanitized (escHtml() 래핑 없이 innerHTML 직접 삽입 차단)

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
          // escHtml()로 래핑된 값은 안전하다고 간주
          methods: ['escHtml'],
        },
      },
    ],
    // insertAdjacentHTML() 등 DOM method 에 escHtml() 없이 변수 삽입 금지
    'no-unsanitized/method': [
      'error',
      {
        escape: {
          methods: ['escHtml'],
        },
      },
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
