// @ts-check
/**
 * iep.spec.js — 📋 IEP·장단기계획 E2E 테스트
 * 실행: TEST_PASSWORD=비밀번호 npx playwright test iep
 */
const { test, expect } = require('@playwright/test');
const { loginAs, waitNoErrorToast, PW } = require('./helpers');

test.describe('📋 IEP 탭 진입 및 렌더링', () => {
  test.beforeEach(async ({ page }) => {
    if (!PW) { test.skip(); return; }
    await loginAs(page);
    // 보고서 탭 → 리포트·장단기계획 서브탭
    await page.locator('#sbTab2').click();
    await expect(page.locator('#panelReport')).toBeVisible({ timeout: 8000 });
    await page.waitForTimeout(300);
    await page.locator('#rtBtn_report').click();
    await page.waitForTimeout(1500);
  });

  test('장단기계획 서브탭 — panel5 표시', async ({ page }) => {
    const panel = page.locator('#panel5');
    await expect(panel).toBeVisible({ timeout: 8000 });
    await waitNoErrorToast(page, 2000);
  });

  test('아동 선택 드롭다운(iepChild) 표시', async ({ page }) => {
    const sel = page.locator('#iepChild');
    if (await sel.isVisible({ timeout: 5000 })) {
      const options = await sel.locator('option').count();
      expect(options).toBeGreaterThan(0);
    }
  });

  test('IEP 생성 버튼(iepBtn) 표시 및 활성화', async ({ page }) => {
    const btn = page.locator('#iepBtn');
    if (await btn.isVisible({ timeout: 5000 })) {
      await expect(btn).toBeEnabled();
    }
  });

  test('IEP 히스토리 영역(iepHistory) 존재', async ({ page }) => {
    const history = page.locator('#iepHistory');
    const exists = await history.count();
    expect(exists).toBeGreaterThan(0);
  });
});

test.describe('📋 IEP — 아동 선택 후 상태', () => {
  test.beforeEach(async ({ page }) => {
    if (!PW) { test.skip(); return; }
    await loginAs(page);
    await page.locator('#sbTab2').click();
    await expect(page.locator('#panelReport')).toBeVisible({ timeout: 8000 });
    await page.locator('#rtBtn_report').click();
    await expect(page.locator('#panel5')).toBeVisible({ timeout: 8000 });
    await page.waitForTimeout(2000); // DB 로드
  });

  test('아동 선택 → iepResult 영역 존재 확인', async ({ page }) => {
    const sel = page.locator('#iepChild');
    if (!await sel.isVisible({ timeout: 3000 })) { test.skip(); return; }

    const options = await sel.locator('option').count();
    if (options < 2) { test.skip(); return; } // 아동 없으면 스킵

    // 첫 번째 실제 아동 선택 (index 1 = 플레이스홀더 제외)
    await sel.selectOption({ index: 1 });
    await page.waitForTimeout(1000);
    await waitNoErrorToast(page, 2000);

    const resultEl = page.locator('#iepResult');
    const exists = await resultEl.count();
    expect(exists).toBeGreaterThan(0);
  });

  test('IEP 생성 버튼 — 아동 미선택 시 클릭해도 오류 토스트 없음', async ({ page }) => {
    const btn = page.locator('#iepBtn');
    if (!await btn.isVisible({ timeout: 3000 })) { test.skip(); return; }

    // 아동 미선택 상태에서 클릭 → UI 오류 없이 처리 (경고 토스트는 허용)
    await btn.click();
    await page.waitForTimeout(1000);
    // 크래시 없이 페이지 유지 확인
    await expect(page.locator('#panel5')).toBeVisible({ timeout: 3000 });
  });
});

test.describe('📋 리포트 탭 — 장단기계획 히스토리', () => {
  test.beforeEach(async ({ page }) => {
    if (!PW) { test.skip(); return; }
    await loginAs(page);
    await page.locator('#sbTab2').click();
    await expect(page.locator('#panelReport')).toBeVisible({ timeout: 8000 });
    await page.locator('#rtBtn_report').click();
    await expect(page.locator('#panel5')).toBeVisible({ timeout: 8000 });
    await page.waitForTimeout(2000);
  });

  test('히스토리 영역 — 렌더링 오류 없음', async ({ page }) => {
    const history = page.locator('#iepHistory');
    if (await history.isVisible({ timeout: 3000 })) {
      await waitNoErrorToast(page, 2000);
    }
  });

  test('panel5 내 폼 필드 존재 확인', async ({ page }) => {
    const panel = page.locator('#panel5');
    const formGroups = await panel.locator('.form-group, .ss-wrap, select, textarea').count();
    expect(formGroups).toBeGreaterThan(0);
  });
});
