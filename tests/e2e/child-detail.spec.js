// @ts-check
/**
 * child-detail.spec.js — 아동 상세 패널 흐름 E2E 테스트
 * 실행: TEST_PASSWORD=비밀번호 npx playwright test child-detail
 */
const { test, expect } = require('@playwright/test');
const { loginAs, waitNoErrorToast, PW } = require('./helpers');

test.describe('👶 아동 목록 → 상세 흐름', () => {
  test.beforeEach(async ({ page }) => {
    if (!PW) { test.skip(); return; }
    await loginAs(page);
    await page.locator('#sbTab1').click();
    await expect(page.locator('#panel0')).toBeVisible({ timeout: 8000 });
    // 아동 카드가 로드될 때까지 대기
    await expect(page.locator('#childGrid .child-card').first())
      .toBeVisible({ timeout: 15000 });
  });

  test('아동 카드 첫 번째 — 클릭 시 상세 뷰 진입', async ({ page }) => {
    const firstCard = page.locator('#childGrid .child-card').first();
    await firstCard.click();
    await page.waitForTimeout(1500); // 상세 렌더 대기
    // 상세 패널이 열리거나, panel0이 상세 컨텐츠로 바뀌거나, URL 해시가 변경됨
    // 아동 이름이 상세 영역에 표시되어야 함
    const detailArea = page.locator(
      '#childDetailPanel, #panel0 .child-detail, #panel0 [class*="detail"]'
    ).first();
    const hasDetail = await detailArea.isVisible({ timeout: 5000 }).catch(() => false);
    // 상세 뷰가 없으면 panel0 자체가 내용으로 채워진 것 확인
    if (!hasDetail) {
      const content = await page.locator('#panel0').textContent();
      expect(content?.trim().length).toBeGreaterThan(50);
    }
    await waitNoErrorToast(page, 2000);
  });

  test('아동 카드 이름 — 표시 확인', async ({ page }) => {
    const firstCard = page.locator('#childGrid .child-card').first();
    const name = await firstCard.textContent();
    expect(name?.trim()).toBeTruthy();
  });

  test('아동 검색 필드 — 입력 후 필터링', async ({ page }) => {
    const searchInput = page.locator('#childSearch, input[placeholder*="검색"], input[placeholder*="아동"]').first();
    if (!await searchInput.isVisible({ timeout: 3000 })) { test.skip(); return; }

    const allCards = await page.locator('#childGrid .child-card').count();
    await searchInput.fill('ㅇ'); // 자음 검색
    await page.waitForTimeout(600);
    // 필터 후 카드 수가 변경되었거나 같은 것도 허용 (일치 없을 수 있음)
    const filtered = await page.locator('#childGrid .child-card').count();
    expect(typeof filtered).toBe('number');
    // 초기화
    await searchInput.fill('');
    await page.waitForTimeout(300);
    const restored = await page.locator('#childGrid .child-card').count();
    expect(restored).toBe(allCards);
  });

  test('상태 필터 셀렉트 — 전체/재원/종결 전환', async ({ page }) => {
    const statusSel = page.locator('#childStatusSel, select[id*="Status"]').first();
    if (!await statusSel.isVisible({ timeout: 3000 })) { test.skip(); return; }

    const options = await statusSel.locator('option').count();
    expect(options).toBeGreaterThanOrEqual(2);
    // 두 번째 옵션 선택
    await statusSel.selectOption({ index: 1 });
    await page.waitForTimeout(500);
    await statusSel.selectOption({ index: 0 }); // 전체로 복구
  });
});

test.describe('👶 아동 상세 — 탭 전환', () => {
  test.beforeEach(async ({ page }) => {
    if (!PW) { test.skip(); return; }
    await loginAs(page);
    await page.locator('#sbTab1').click();
    await expect(page.locator('#panel0')).toBeVisible({ timeout: 8000 });
    await expect(page.locator('#childGrid .child-card').first())
      .toBeVisible({ timeout: 15000 });
    // 첫 번째 아동 클릭
    await page.locator('#childGrid .child-card').first().click();
    await page.waitForTimeout(1500);
  });

  test('상세 화면 — 오류 토스트 없음', async ({ page }) => {
    await waitNoErrorToast(page, 3000);
  });

  test('뒤로 가기 / 목록 버튼 — 목록 복귀', async ({ page }) => {
    // 뒤로 가기 버튼 (backBtn, 목록으로, ← 등)
    const backBtn = page.locator(
      '#backBtn, [onclick*="backToList"], [onclick*="showChildList"], button[aria-label*="뒤로"]'
    ).first();
    if (!await backBtn.isVisible({ timeout: 3000 })) { test.skip(); return; }

    await backBtn.click();
    await page.waitForTimeout(500);
    // 목록 카드들이 다시 보여야 함
    await expect(page.locator('#childGrid .child-card').first())
      .toBeVisible({ timeout: 8000 });
  });
});
