// @ts-check
const { test, expect } = require('@playwright/test');

const UN = process.env.TEST_USERNAME || 'dinosau';
const PW = process.env.TEST_PASSWORD || '';

// 세션 완전 초기화 — httpOnly Cookie + localStorage 모두 제거
async function clearSession(page) {
  await page.context().clearCookies();
}

async function goToLogin(page) {
  await clearSession(page);
  await page.goto('/MADI/');
  await expect(page.locator('#landingScreen')).toBeVisible({ timeout: 10000 });
  await page.locator('.lp-btn-login').click();
  await expect(page.locator('#loginScreen')).toBeVisible({ timeout: 5000 });
}

test.describe('로그인', () => {
  test('로그인 화면이 표시된다', async ({ page }) => {
    await goToLogin(page);
    await expect(page.locator('#loginUsernameInput')).toBeVisible();
    await expect(page.locator('#loginPwInput')).toBeVisible();
    await expect(page.locator('#loginSubmitBtn')).toBeVisible();
  });

  test('잘못된 비밀번호 → 오류 메시지 표시', async ({ page }) => {
    await goToLogin(page);
    await page.fill('#loginUsernameInput', UN);
    await page.fill('#loginPwInput', 'wrongpassword1');
    await page.click('#loginSubmitBtn');
    await expect(page.locator('#loginError')).not.toBeEmpty({ timeout: 8000 });
  });

  test('올바른 계정으로 로그인 성공', async ({ page }) => {
    if (!PW) { test.skip(); return; }
    await goToLogin(page);
    await page.fill('#loginUsernameInput', UN);
    await page.fill('#loginPwInput', PW);
    await page.click('#loginSubmitBtn');
    await expect(page.locator('#sbTab7')).toBeVisible({ timeout: 10000 });
  });
});
