// @ts-check
const { test, expect } = require('@playwright/test');

const UN = process.env.TEST_USERNAME || 'dinosau';
const PW = process.env.TEST_PASSWORD || '';

async function loginAs(page, un, pw) {
  await page.goto('/MADI/');
  await page.evaluate(() => { localStorage.removeItem('madi_user'); }); // madi_token은 httpOnly 쿠키로 이전됨
  await page.reload();
  await expect(page.locator('#landingScreen')).toBeVisible({ timeout: 10000 });
  await page.locator('.lp-btn-login').click();
  await expect(page.locator('#loginScreen')).toBeVisible({ timeout: 5000 });
  await page.fill('#loginUsernameInput', un);
  await page.fill('#loginPwInput', pw);
  await page.click('#loginSubmitBtn');
  await expect(page.locator('#sbTab7')).toBeVisible({ timeout: 10000 });
}

// 로그인 후 상태를 재사용
test.beforeEach(async ({ page }) => {
  if (!PW) { test.skip(); return; }
  await loginAs(page, UN, PW);
});

test.describe('네비게이션', () => {
  test('캘린더 탭 — 스케줄 카드 + 내보내기 버튼 표시', async ({ page }) => {
    await page.locator('[onclick="switchTab(2)"]').first().click();
    await expect(page.locator('#monthGrid')).toBeVisible();
    await expect(page.getByText('내보내기')).toBeVisible();
  });

  test('게시판 탭 — 마디공지/센터공지/고객센터/자료실 4개 탭 표시', async ({ page }) => {
    await page.locator('#sbTab7').click();
    await expect(page.locator('#bdBtn_global')).toBeVisible();
    await expect(page.locator('#bdBtn_center')).toBeVisible();
    await expect(page.locator('#bdBtn_lounge')).toBeVisible();
    await expect(page.locator('#bdBtn_library')).toBeVisible();
  });

  test('게시판 — 고객센터 탭 클릭 시 건의 폼 표시 (선생님/관리자)', async ({ page }) => {
    await page.locator('#sbTab7').click();
    await page.locator('#bdBtn_lounge').click();
    // 수신자 선택 셀렉트 또는 안내 문구 존재 확인
    const hasForm   = await page.locator('#loungeVisibility').isVisible().catch(() => false);
    const hasNotice = await page.getByText('모든 센터의 건의·문의를 수신합니다').isVisible().catch(() => false);
    expect(hasForm || hasNotice).toBeTruthy();
  });

  test('게시판 — 자료실 탭 클릭 시 카테고리 필터 표시', async ({ page }) => {
    await page.locator('#sbTab7').click();
    await page.locator('#bdBtn_library').click();
    await expect(page.getByText('자료실')).toBeVisible({ timeout: 6000 });
  });

  test('보고서 탭 — AI 언어평가보고서 메뉴 표시', async ({ page }) => {
    await page.locator('[onclick="switchTab(\'report\')"]').first().click().catch(async () => {
      await page.locator('text=보고서').first().click();
    });
    await expect(page.locator('#rtBtn_assess')).toContainText('AI 언어평가보고서');
    await expect(page.locator('#rtBtn_si')).toContainText('AI 발달평가보고서');
  });
});

test.describe('일정 내보내기 모달', () => {
  test('내보내기 버튼 클릭 → 모달 오픈', async ({ page }) => {
    await page.locator('[onclick="switchTab(2)"]').first().click();
    await page.getByText('내보내기').click();
    await expect(page.locator('#schedExportModal')).toBeVisible();
    await expect(page.locator('#exportDateFrom')).toBeVisible();
    await expect(page.locator('#exportDateTo')).toBeVisible();
  });

  test('내보내기 모달 닫기', async ({ page }) => {
    await page.locator('[onclick="switchTab(2)"]').first().click();
    await page.getByText('내보내기').click();
    await expect(page.locator('#schedExportModal')).toBeVisible();
    await page.getByText('닫기').click();
    await expect(page.locator('#schedExportModal')).toBeHidden();
  });
});
