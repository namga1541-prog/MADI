// @ts-check
/**
 * dashboard.spec.js — 홈·대시보드 렌더링 E2E 테스트
 * 실행: TEST_PASSWORD=비밀번호 npx playwright test dashboard
 */
const { test, expect } = require('@playwright/test');
const { loginAs, PW } = require('./helpers');

test.describe('🏠 홈 대시보드', () => {
  test.beforeEach(async ({ page }) => {
    if (!PW) { test.skip(); return; }
    await loginAs(page);
  });

  test('홈 탭 클릭 — panelHome 표시', async ({ page }) => {
    await page.locator('#sbHome').click();
    await expect(page.locator('#panelHome')).toBeVisible({ timeout: 8000 });
  });

  test('대시보드 환영 인사 영역 표시', async ({ page }) => {
    await page.locator('#sbHome').click();
    await expect(page.locator('#panelHome')).toBeVisible({ timeout: 8000 });
    // dashWelcome 또는 dashGreeting 중 하나 표시
    const welcome = page.locator('#dashWelcome, #dashTeacher, #dashAdmin, #dashLegacy');
    await expect(welcome.first()).toBeVisible({ timeout: 10000 });
  });

  test('대시보드 날짜 표시', async ({ page }) => {
    await page.locator('#sbHome').click();
    await expect(page.locator('#panelHome')).toBeVisible({ timeout: 8000 });
    const dateEl = page.locator('#dashDate');
    if (await dateEl.isVisible({ timeout: 3000 })) {
      const text = await dateEl.textContent();
      expect(text?.trim()).toBeTruthy();
    }
  });

  test('오늘의 일정 카드 영역 렌더링', async ({ page }) => {
    await page.locator('#sbHome').click();
    await expect(page.locator('#panelHome')).toBeVisible({ timeout: 8000 });
    await page.waitForTimeout(2000); // DB 로드 대기
    // dashTodaySched가 있거나 dash-card가 1개 이상
    const todaySched = page.locator('#dashTodaySched');
    const dashCards  = page.locator('#panelHome .dash-card');
    const hasSched = await todaySched.isVisible().catch(() => false);
    const cardCnt  = await dashCards.count().catch(() => 0);
    expect(hasSched || cardCnt > 0).toBeTruthy();
  });

  test('아동 통계 카드 — 숫자 표시', async ({ page }) => {
    await page.locator('#sbHome').click();
    await expect(page.locator('#panelHome')).toBeVisible({ timeout: 8000 });
    await page.waitForTimeout(2000);
    const statEl = page.locator('#dashChildStat, #dashMiniStat');
    if (await statEl.first().isVisible({ timeout: 3000 })) {
      const text = await statEl.first().textContent();
      expect(text?.trim()).toBeTruthy();
    }
  });
});

test.describe('🏠 홈 대시보드 — 탭 재진입', () => {
  test.beforeEach(async ({ page }) => {
    if (!PW) { test.skip(); return; }
    await loginAs(page);
  });

  test('다른 탭 → 홈 탭 재진입 시 대시보드 정상 표시', async ({ page }) => {
    // 캘린더 탭으로 이동 후 홈으로 돌아오기
    await page.locator('#sbTab0').click();
    await expect(page.locator('#panel2')).toBeVisible({ timeout: 8000 });
    await page.locator('#sbHome').click();
    await expect(page.locator('#panelHome')).toBeVisible({ timeout: 8000 });
    const dashboard = page.locator('#dashTeacher, #dashAdmin, #dashLegacy, #dashWelcome');
    await expect(dashboard.first()).toBeVisible({ timeout: 10000 });
  });
});
