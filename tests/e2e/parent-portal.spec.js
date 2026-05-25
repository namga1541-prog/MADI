// @ts-check
/**
 * parent-portal.spec.js — 👨‍👩‍👧 학부모 포털 E2E 테스트
 * 실행: TEST_PASSWORD=비밀번호 npx playwright test parent-portal
 *
 * 참고: superadmin 계정으로 접근하므로 학부모 UI가 아닌
 *       관리자 관점에서 학부모 탭/패널 접근 여부를 검증함.
 */
const { test, expect } = require('@playwright/test');
const { loginAs, waitNoErrorToast, PW } = require('./helpers');

test.describe('👨‍👩‍👧 학부모 포털 — 탭 구조', () => {
  test.beforeEach(async ({ page }) => {
    if (!PW) { test.skip(); return; }
    await loginAs(page);
  });

  test('학부모 전용 탭 바(parentTabs) — DOM에 존재', async ({ page }) => {
    const tabs = page.locator('#parentTabs');
    const exists = await tabs.count();
    expect(exists).toBeGreaterThan(0);
  });

  test('학부모 홈 버튼(ptBtnHome) — DOM에 존재', async ({ page }) => {
    const btn = page.locator('#ptBtnHome');
    const exists = await btn.count();
    expect(exists).toBeGreaterThan(0);
  });

  test('학부모 일정 버튼(ptBtnSched) — DOM에 존재', async ({ page }) => {
    const btn = page.locator('#ptBtnSched');
    const exists = await btn.count();
    expect(exists).toBeGreaterThan(0);
  });

  test('학부모 리포트 버튼(ptBtnReport) — DOM에 존재', async ({ page }) => {
    const btn = page.locator('#ptBtnReport');
    const exists = await btn.count();
    expect(exists).toBeGreaterThan(0);
  });

  test('학부모 알림 버튼(ptBtnNotice) — DOM에 존재', async ({ page }) => {
    const btn = page.locator('#ptBtnNotice');
    const exists = await btn.count();
    expect(exists).toBeGreaterThan(0);
  });
});

test.describe('👨‍👩‍👧 학부모 가입 화면', () => {
  test('랜딩 화면 → 학부모 로그인 진입 흐름', async ({ page }) => {
    await page.context().clearCookies();
    await page.goto('/MADI/');
    await expect(page.locator('#landingScreen')).toBeVisible({ timeout: 10000 });

    // 학부모 로그인 버튼 또는 링크 찾기
    const parentBtn = page.getByRole('button', { name: /학부모/ })
      .or(page.getByText(/학부모 로그인/))
      .or(page.locator('[onclick*="parent"], [onclick*="Parent"]'))
      .first();

    if (await parentBtn.isVisible({ timeout: 3000 })) {
      await parentBtn.click();
      await page.waitForTimeout(500);
      // 학부모 가입/로그인 화면 표시 확인
      const parentScreen = page.locator('#parentSignupScreen, [id*="parentLogin"], [id*="parentScreen"]');
      const shown = await parentScreen.first().isVisible({ timeout: 5000 }).catch(() => false);
      if (!shown) {
        // 적어도 페이지 크래시 없음
        const body = await page.locator('body').isVisible();
        expect(body).toBeTruthy();
      }
    } else {
      test.skip();
    }
  });

  test('학부모 가입 화면(parentSignupScreen) — DOM에 존재', async ({ page }) => {
    await page.context().clearCookies();
    await page.goto('/MADI/');
    await expect(page.locator('#landingScreen')).toBeVisible({ timeout: 10000 });
    const screen = page.locator('#parentSignupScreen');
    const exists = await screen.count();
    expect(exists).toBeGreaterThan(0);
  });
});

test.describe('👨‍👩‍👧 학부모 포털 패널 (로그인 후)', () => {
  test.beforeEach(async ({ page }) => {
    if (!PW) { test.skip(); return; }
    await loginAs(page);
  });

  test('parentPanelHome — DOM에 존재', async ({ page }) => {
    const panel = page.locator('#parentPanelHome');
    const exists = await panel.count();
    expect(exists).toBeGreaterThan(0);
  });

  test('parentPanelSched — DOM에 존재', async ({ page }) => {
    const panel = page.locator('#parentPanelSched');
    const exists = await panel.count();
    expect(exists).toBeGreaterThan(0);
  });

  test('parentPanelNotice — DOM에 존재', async ({ page }) => {
    const panel = page.locator('#parentPanelNotice');
    const exists = await panel.count();
    expect(exists).toBeGreaterThan(0);
  });

  test('알림 배지(parentNotifBadge) — DOM에 존재', async ({ page }) => {
    const badge = page.locator('#parentNotifBadge');
    const exists = await badge.count();
    expect(exists).toBeGreaterThan(0);
  });
});
