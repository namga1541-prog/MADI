// @ts-check
/**
 * ai-chat.spec.js — 🤖 AI 비서 "마로" 채팅 E2E 테스트
 * 실행: TEST_PASSWORD=비밀번호 npx playwright test ai-chat
 */
const { test, expect } = require('@playwright/test');
const { loginAs, waitNoErrorToast, PW } = require('./helpers');

test.describe('🤖 AI 비서 플로팅 버튼', () => {
  test.beforeEach(async ({ page }) => {
    if (!PW) { test.skip(); return; }
    await loginAs(page);
    await page.waitForTimeout(500);
  });

  test('플로팅 버튼(floatBtn) 표시', async ({ page }) => {
    await expect(page.locator('#floatBtn')).toBeVisible({ timeout: 8000 });
  });

  test('floatBtn 이름 텍스트 표시 (마로 등)', async ({ page }) => {
    const btn = page.locator('#floatBtn');
    await expect(btn).toBeVisible({ timeout: 8000 });
    const text = await btn.textContent();
    expect(text?.trim()).toBeTruthy();
  });

  test('floatBtn 클릭 → chatWindow 표시', async ({ page }) => {
    await page.locator('#floatBtn').click();
    await expect(page.locator('#chatWindow')).toBeVisible({ timeout: 8000 });
  });

  test('chatWindow 열기 → 닫기 (토글)', async ({ page }) => {
    // 열기
    await page.locator('#floatBtn').click();
    await expect(page.locator('#chatWindow')).toBeVisible({ timeout: 8000 });

    // 다시 클릭 → 닫기
    await page.locator('#floatBtn').click();
    await expect(page.locator('#chatWindow')).toBeHidden({ timeout: 5000 });
  });
});

test.describe('🤖 AI 채팅 창 내부', () => {
  test.beforeEach(async ({ page }) => {
    if (!PW) { test.skip(); return; }
    await loginAs(page);
    await page.locator('#floatBtn').click();
    await expect(page.locator('#chatWindow')).toBeVisible({ timeout: 8000 });
  });

  test('채팅 메시지 영역 표시', async ({ page }) => {
    await expect(page.locator('#chatMessages')).toBeVisible({ timeout: 5000 });
  });

  test('입력 텍스트 영역 표시 및 입력 가능', async ({ page }) => {
    const input = page.locator('#chatInput');
    await expect(input).toBeVisible({ timeout: 5000 });
    await input.fill('안녕하세요');
    const val = await input.inputValue();
    expect(val).toBe('안녕하세요');
    await input.fill(''); // 초기화
  });

  test('전송 버튼 표시', async ({ page }) => {
    await expect(page.locator('#chatSendBtn')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('#chatSendBtn')).toBeEnabled();
  });

  test('음성 입력 버튼 표시', async ({ page }) => {
    const micBtn = page.locator('#chatMicBtn');
    const exists = await micBtn.count();
    expect(exists).toBeGreaterThan(0);
  });

  test('빠른 버튼(chatQuickBtns) 표시', async ({ page }) => {
    const quickBtns = page.locator('#chatQuickBtns');
    if (await quickBtns.isVisible({ timeout: 3000 })) {
      const buttons = await quickBtns.locator('button, .quick-btn').count();
      expect(buttons).toBeGreaterThan(0);
    }
  });

  test('빠른 버튼 클릭 → 입력창에 텍스트 삽입 또는 전송', async ({ page }) => {
    const firstQuick = page.locator('#chatQuickBtns .quick-btn, #chatQuickBtns button').first();
    if (!await firstQuick.isVisible({ timeout: 3000 })) { test.skip(); return; }

    await firstQuick.click();
    await page.waitForTimeout(1000);
    // 에러 없이 동작하면 성공
    await waitNoErrorToast(page, 2000);
  });

  test('채팅 창 — 오류 없이 타 탭 이동 후 재오픈', async ({ page }) => {
    // 다른 탭으로 이동
    await page.locator('#sbTab0').click();
    await page.waitForTimeout(500);
    // 다시 플로팅 버튼 클릭 → 채팅 창 재오픈
    await page.locator('#floatBtn').click();
    await expect(page.locator('#chatWindow')).toBeVisible({ timeout: 8000 });
    await waitNoErrorToast(page, 2000);
  });
});
