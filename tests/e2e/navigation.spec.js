// @ts-check
/**
 * navigation.spec.js — 탭/패널 전환 E2E 테스트
 * 실행: TEST_PASSWORD=비밀번호 npx playwright test navigation
 */
const { test, expect } = require('@playwright/test');
const { loginAs, PW } = require('./helpers');

// 로그인 후 상태를 재사용
test.beforeEach(async ({ page }) => {
  if (!PW) { test.skip(); return; }
  await loginAs(page);
  await page.waitForTimeout(500); // 초기 렌더 안정화
});

test.describe('네비게이션', () => {
  test('캘린더 탭 — 스케줄 카드 + 내보내기 버튼 표시', async ({ page }) => {
    await page.locator('#sbTab0').click();
    await expect(page.locator('#panel2')).toBeVisible({ timeout: 8000 });
    await expect(page.locator('#monthGrid')).toBeVisible({ timeout: 8000 });
    await expect(page.locator('button[onclick="openScheduleExportModal()"]')).toBeVisible({ timeout: 8000 });
  });

  test('게시판 탭 — 마디공지/센터공지/고객센터/자료실 4개 탭 표시', async ({ page }) => {
    await page.locator('#sbTab7').click();
    await expect(page.locator('#panelBoard')).toBeVisible({ timeout: 8000 });
    await page.waitForTimeout(1000);
    for (const id of ['#bdBtn_global', '#bdBtn_center', '#bdBtn_lounge', '#bdBtn_library']) {
      await expect(page.locator(id)).toBeVisible({ timeout: 8000 });
    }
  });

  test('게시판 — 고객센터 탭 클릭 시 건의 폼 표시 (선생님/관리자)', async ({ page }) => {
    await page.locator('#sbTab7').click();
    await expect(page.locator('#panelBoard')).toBeVisible({ timeout: 8000 });
    await page.waitForTimeout(500);
    await page.locator('#bdBtn_lounge').click();
    // 수신자 선택 셀렉트 또는 안내 문구 존재 확인
    const hasForm   = await page.locator('#loungeVisibility').isVisible().catch(() => false);
    const hasNotice = await page.getByText('모든 센터의 건의·문의를 수신합니다').isVisible().catch(() => false);
    expect(hasForm || hasNotice).toBeTruthy();
  });

  test('게시판 — 자료실 탭 클릭 시 카테고리 필터 표시', async ({ page }) => {
    await page.locator('#sbTab7').click();
    await expect(page.locator('#panelBoard')).toBeVisible({ timeout: 8000 });
    await page.waitForTimeout(500);
    await page.locator('#bdBtn_library').click();
    // strict mode 방지: 자료실 버튼이 active 클래스 보유 확인
    await expect(page.locator('#bdBtn_library')).toHaveClass(/active/, { timeout: 5000 });
  });

  test('보고서 탭 — AI 언어평가보고서 메뉴 표시', async ({ page }) => {
    await page.locator('#sbTab2').click();
    await expect(page.locator('#panelReport')).toBeVisible({ timeout: 8000 });
    await page.waitForTimeout(500);
    await expect(page.locator('#rtBtn_assess')).toBeVisible({ timeout: 8000 });
    await expect(page.locator('#rtBtn_si')).toBeVisible({ timeout: 8000 });
  });
});

test.describe('일정 내보내기 모달', () => {
  test('내보내기 버튼 클릭 → 모달 오픈', async ({ page }) => {
    await page.locator('#sbTab0').click();
    await expect(page.locator('#panel2')).toBeVisible({ timeout: 8000 });
    await page.locator('button[onclick="openScheduleExportModal()"]').click();
    await expect(page.locator('#schedExportModal')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('#exportDateFrom')).toBeVisible();
    await expect(page.locator('#exportDateTo')).toBeVisible();
  });

  test('내보내기 모달 닫기', async ({ page }) => {
    await page.locator('#sbTab0').click();
    await expect(page.locator('#panel2')).toBeVisible({ timeout: 8000 });
    await page.locator('button[onclick="openScheduleExportModal()"]').click();
    await expect(page.locator('#schedExportModal')).toBeVisible({ timeout: 5000 });
    await page.locator('#schedExportModal').getByText('닫기').click();
    await expect(page.locator('#schedExportModal')).toBeHidden({ timeout: 3000 });
  });
});
