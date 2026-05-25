// @ts-check
const { defineConfig, devices } = require('@playwright/test');

module.exports = defineConfig({
  testDir: './tests/e2e',
  timeout: 30000,
  retries: process.env.CI ? 2 : 1,
  reporter: [
    ['html', { open: 'never', outputFolder: 'playwright-report' }],
    ['list'],
  ],
  use: {
    baseURL: process.env.BASE_URL || 'https://namga1541-prog.github.io',
    headless: process.env.HEADED !== '1',   // HEADED=1 이면 브라우저 화면 표시
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    trace: 'retain-on-failure',
    viewport: { width: 1280, height: 800 },
    locale: 'ko-KR',
  },
  projects: [
    // 기본 프로젝트 — sentinel 제외한 전체 테스트
    {
      name: 'chromium',
      testIgnore: '**/sentinel.spec.js',
      use: { ...devices['Desktop Chrome'] },
    },
    // Post-Deploy Sentinel — 배포 후 라이브 URL 스모크 (약 20초)
    // 실행: npx playwright test --project=sentinel
    {
      name: 'sentinel',
      testMatch: '**/sentinel.spec.js',
      use: {
        ...devices['Desktop Chrome'],
        baseURL: 'https://namga1541-prog.github.io',
      },
    },
  ],
  // 테스트 파일별 순서 고정 (인증 → 버튼 → 폼)
  // 각 파일은 독립 실행 가능
});
