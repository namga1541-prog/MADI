// @ts-check
// 공통 헬퍼 — 모든 spec 파일에서 import해 사용

const { expect } = require('@playwright/test');

const BASE = '/MADI/';
const UN = process.env.TEST_USERNAME || 'dinosau';
const PW = process.env.TEST_PASSWORD || '';

/**
 * 세션 초기화 후 로그인
 * 로그인 직후 표시되는 업데이트 공지 팝업(#loginUpdatePopup)을 자동으로 닫음
 */
async function loginAs(page, un = UN, pw = PW) {
  await page.context().clearCookies();
  await page.goto(BASE);
  await expect(page.locator('#landingScreen')).toBeVisible({ timeout: 10000 });
  await page.getByRole('button', { name: '로그인' }).first().click();
  await expect(page.locator('#loginScreen')).toBeVisible({ timeout: 5000 });
  await page.fill('#loginUsernameInput', un);
  await page.fill('#loginPwInput', pw);
  await page.click('#loginSubmitBtn');
  // 로그인 성공 = 사이드바 탭 노출
  await expect(page.locator('#sbTab7')).toBeVisible({ timeout: 12000 });
  // 로그인 직후 공지 팝업 자동 닫기 (z-index:10000 오버레이가 이후 클릭을 막음)
  try {
    const popup = page.locator('#loginUpdatePopup');
    await popup.waitFor({ state: 'visible', timeout: 4000 });
    // '닫기' 버튼(lupClose2) 클릭
    await page.locator('#lupClose2').click({ timeout: 3000 });
    await popup.waitFor({ state: 'hidden', timeout: 2000 });
  } catch (_e) {
    // 팝업이 없거나 이미 닫혔으면 계속 진행
  }
}

/**
 * 로그인 필요 여부 체크 — PW 없으면 테스트 스킵
 */
function requireLogin(test) {
  test.beforeEach(async ({ page }) => {
    if (!PW) { test.skip(); return; }
    await loginAs(page);
  });
}

/**
 * 토스트 메시지 대기 (오류 감지용)
 */
async function waitNoErrorToast(page, ms = 3000) {
  // 에러 토스트가 뜨지 않아야 함
  const toast = page.locator('#toast, .toast');
  try {
    await toast.waitFor({ state: 'visible', timeout: ms });
    const text = await toast.textContent() || '';
    if (text.includes('⚠️') || text.includes('오류') || text.includes('실패')) {
      throw new Error(`오류 토스트 발생: ${text}`);
    }
  } catch (e) {
    if (e.message.startsWith('오류 토스트')) throw e;
    // 토스트 없으면 정상
  }
}

module.exports = { loginAs, requireLogin, waitNoErrorToast, UN, PW, BASE };
