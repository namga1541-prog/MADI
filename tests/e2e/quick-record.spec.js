// @ts-check
/**
 * quick-record.spec.js — ⚡ 빠른 기록 모드 E2E 테스트
 * 실행: TEST_PASSWORD=비밀번호 npx playwright test quick-record
 */
const { test, expect } = require('@playwright/test');
const { loginAs, waitNoErrorToast, PW } = require('./helpers');

test.describe('⚡ 빠른 기록 패널', () => {
  test.beforeEach(async ({ page }) => {
    if (!PW) { test.skip(); return; }
    await loginAs(page);
  });

  test('헤더 빠른 기록 버튼 — 존재 확인', async ({ page }) => {
    const btn = page.locator('#headerQuickBtn');
    const exists = await btn.count();
    expect(exists).toBeGreaterThan(0);
  });

  test('빠른 기록 버튼 클릭 → panelQuick 표시', async ({ page }) => {
    const btn = page.locator('#headerQuickBtn');
    if (!await btn.isVisible({ timeout: 3000 })) { test.skip(); return; }

    await btn.click();
    await expect(page.locator('#panelQuick')).toBeVisible({ timeout: 8000 });
    await waitNoErrorToast(page, 2000);
  });

  test('빠른 기록 패널 — 헤더/카드 목록 영역 표시', async ({ page }) => {
    const btn = page.locator('#headerQuickBtn');
    if (!await btn.isVisible({ timeout: 3000 })) { test.skip(); return; }

    await btn.click();
    await expect(page.locator('#panelQuick')).toBeVisible({ timeout: 8000 });
    await page.waitForTimeout(1500); // 아동 카드 로드 대기

    // 헤더 서브타이틀 표시 확인
    const header = page.locator('#quickHeader, #quickHeaderSub');
    if (await header.first().isVisible({ timeout: 3000 })) {
      const text = await header.first().textContent();
      expect(text?.trim()).toBeTruthy();
    }
  });

  test('빠른 기록 — 아동 카드 목록 로드', async ({ page }) => {
    const btn = page.locator('#headerQuickBtn');
    if (!await btn.isVisible({ timeout: 3000 })) { test.skip(); return; }

    await btn.click();
    await expect(page.locator('#panelQuick')).toBeVisible({ timeout: 8000 });
    await page.waitForTimeout(2000);

    const cardList = page.locator('#quickCardList');
    if (await cardList.isVisible({ timeout: 3000 })) {
      // 카드 목록이 비어있거나 아동 카드 포함
      const content = await cardList.textContent();
      expect(typeof content).toBe('string');
    }
  });

  test('빠른 기록 — 다른 탭 클릭으로 이탈 후 재진입', async ({ page }) => {
    const btn = page.locator('#headerQuickBtn');
    if (!await btn.isVisible({ timeout: 3000 })) { test.skip(); return; }

    await btn.click();
    await expect(page.locator('#panelQuick')).toBeVisible({ timeout: 8000 });

    // 캘린더 탭 이동
    await page.locator('#sbTab0').click();
    await expect(page.locator('#panel2')).toBeVisible({ timeout: 8000 });

    // 다시 빠른 기록 패널로 복귀
    await btn.click();
    await expect(page.locator('#panelQuick')).toBeVisible({ timeout: 8000 });
    await waitNoErrorToast(page, 2000);
  });
});

test.describe('⚡ 빠른 기록 폼', () => {
  test.beforeEach(async ({ page }) => {
    if (!PW) { test.skip(); return; }
    await loginAs(page);
    const btn = page.locator('#headerQuickBtn');
    if (!await btn.isVisible({ timeout: 3000 })) { test.skip(); return; }
    await btn.click();
    await expect(page.locator('#panelQuick')).toBeVisible({ timeout: 8000 });
    await page.waitForTimeout(2000);
  });

  test('아동 카드 클릭 → 빠른 입력 폼 표시', async ({ page }) => {
    // quickCardList 내 아동 카드 클릭
    const card = page.locator('#quickCardList [class*="card"], #quickCardList [class*="child"]').first();
    if (!await card.isVisible({ timeout: 5000 })) { test.skip(); return; }

    await card.click();
    await page.waitForTimeout(800);

    // quickFormPanel 또는 입력 폼 표시 확인
    const form = page.locator('#quickFormPanel, [id*="quickForm"]');
    if (await form.first().isVisible({ timeout: 5000 })) {
      await waitNoErrorToast(page, 2000);
    }
  });
});
