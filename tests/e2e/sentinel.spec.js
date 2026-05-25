// @ts-check
/**
 * sentinel.spec.js — Post-Deploy 라이브 URL 스모크 테스트
 *
 * 목적: git push 후 GitHub Pages 배포(1~2분) 완료 시 라이브 사이트 정상 동작 확인
 * 실행: npx playwright test --project=sentinel
 *       (인증 불필요 테스트 3개 + 선택 1개, 약 20초 소요)
 *
 * 주의: TEST_PASSWORD 없어도 3개 테스트는 실행됨
 */
const { test, expect } = require('@playwright/test');
const { loginAs, PW } = require('./helpers');

test.describe('🚀 Post-Deploy Sentinel — 라이브 스모크', () => {

  test('① 랜딩 페이지 렌더링', async ({ page }) => {
    await page.context().clearCookies();
    await page.goto('/MADI/');
    await expect(page.locator('#landingScreen')).toBeVisible({ timeout: 20000 });
  });

  test('② 로그인 버튼 노출 + 활성화', async ({ page }) => {
    await page.context().clearCookies();
    await page.goto('/MADI/');
    await expect(page.locator('#landingScreen')).toBeVisible({ timeout: 20000 });
    const loginBtn = page.getByRole('button', { name: '로그인' }).first();
    await expect(loginBtn).toBeVisible({ timeout: 5000 });
    await expect(loginBtn).toBeEnabled();
  });

  test('③ 로그인 폼 렌더링 (3개 필드)', async ({ page }) => {
    await page.context().clearCookies();
    await page.goto('/MADI/');
    await page.getByRole('button', { name: '로그인' }).first().click();
    await expect(page.locator('#loginScreen')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('#loginUsernameInput')).toBeVisible();
    await expect(page.locator('#loginPwInput')).toBeVisible();
    await expect(page.locator('#loginSubmitBtn')).toBeEnabled();
  });

  test('④ 로그인 성공 후 메인 앱 진입 (비밀번호 필요)', async ({ page }) => {
    if (!PW) { test.skip(); return; }
    await loginAs(page);
    // 핵심 사이드바 탭 4개 확인
    for (const id of ['#sbTab0', '#sbTab1', '#sbTab2', '#sbTab7']) {
      await expect(page.locator(id)).toBeVisible({ timeout: 5000 });
    }
  });

});
