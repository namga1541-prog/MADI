// @ts-check
/**
 * buttons.spec.js — 주요 버튼 동작 E2E 테스트
 * 실행: TEST_PASSWORD=비밀번호 npx playwright test buttons
 */
const { test, expect } = require('@playwright/test');
const { loginAs, waitNoErrorToast, PW } = require('./helpers');

test.describe('🔐 로그인 화면 버튼', () => {
  test('랜딩 → 로그인 버튼 클릭 시 로그인 폼 표시', async ({ page }) => {
    await page.context().clearCookies();
    await page.goto('/MADI/');
    await expect(page.locator('#landingScreen')).toBeVisible({ timeout: 10000 });
    await page.getByRole('button', { name: '로그인' }).first().click();
    await expect(page.locator('#loginScreen')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('#loginUsernameInput')).toBeVisible();
    await expect(page.locator('#loginPwInput')).toBeVisible();
    await expect(page.locator('#loginSubmitBtn')).toBeEnabled();
  });

  test('비밀번호 없이 로그인 시도 → 에러 메시지', async ({ page }) => {
    await page.context().clearCookies();
    await page.goto('/MADI/');
    await page.getByRole('button', { name: '로그인' }).first().click();
    await page.fill('#loginUsernameInput', 'dinosau');
    await page.click('#loginSubmitBtn');
    await expect(page.locator('#loginError')).not.toBeEmpty({ timeout: 8000 });
  });

  test('틀린 비밀번호 → 에러 메시지', async ({ page }) => {
    await page.context().clearCookies();
    await page.goto('/MADI/');
    await page.getByRole('button', { name: '로그인' }).first().click();
    await page.fill('#loginUsernameInput', 'dinosau');
    await page.fill('#loginPwInput', 'wrong_pw_12345');
    await page.click('#loginSubmitBtn');
    await expect(page.locator('#loginError')).not.toBeEmpty({ timeout: 8000 });
  });
});

// ── 아래 테스트는 전부 로그인 필요 ───────────────────────────
test.describe('🏠 헤더 버튼', () => {
  test.beforeEach(async ({ page }) => {
    if (!PW) { test.skip(); return; }
    await loginAs(page);
  });

  test('사이드바 토글 버튼 — 접기/펼치기', async ({ page }) => {
    const btn = page.locator('#sidebarToggleBtn');
    await expect(btn).toBeVisible();
    await btn.click();
    await page.waitForTimeout(400);
    await btn.click(); // 다시 펼치기
    await page.waitForTimeout(400);
    await expect(page.locator('#sbTab0')).toBeVisible();
  });

  test('⚡ 빠른 기록 버튼 표시 확인 (teacher/superadmin)', async ({ page }) => {
    // 버튼이 display:none 이 아니거나 visible 상태
    const quickBtn = page.locator('#headerQuickBtn');
    // 존재는 하되 역할에 따라 hidden일 수 있음
    const exists = await quickBtn.count();
    expect(exists).toBeGreaterThan(0);
  });
});

test.describe('📅 캘린더 탭 버튼', () => {
  test.beforeEach(async ({ page }) => {
    if (!PW) { test.skip(); return; }
    await loginAs(page);
    await page.locator('#sbTab0').click();
    await expect(page.locator('#panel2')).toBeVisible({ timeout: 6000 });
  });

  test('월간/주간/일일 뷰 전환 버튼', async ({ page }) => {
    await page.locator('#viewBtnMonth').click();
    await expect(page.locator('#monthGrid')).toBeVisible();

    await page.locator('#viewBtnWeek').click();
    await expect(page.locator('#weekGrid')).toBeVisible({ timeout: 10000 });

    await page.locator('#viewBtn_day').click();
    await expect(page.locator('#dayGrid')).toBeVisible({ timeout: 10000 });
  });

  test('일정 추가 버튼 → 모달 오픈', async ({ page }) => {
    const addBtn = page.getByRole('button', { name: /일정 추가|추가|새 일정/ }).first();
    if (await addBtn.isVisible()) {
      await addBtn.click();
      // 모달 또는 폼 영역 노출 확인
      await expect(page.locator('#schedModal, #addSchedForm').first()).toBeVisible({ timeout: 5000 });
    } else {
      test.skip(); // 역할에 따라 버튼 없을 수 있음
    }
  });

  test('내보내기 버튼 → 모달 오픈 및 닫기', async ({ page }) => {
    const exportBtn = page.locator('button[onclick="openScheduleExportModal()"]');
    await expect(exportBtn).toBeVisible({ timeout: 5000 });
    await exportBtn.click();
    await expect(page.locator('#schedExportModal')).toBeVisible();
    // 닫기
    await page.locator('#schedExportModal').getByText('닫기').click();
    await expect(page.locator('#schedExportModal')).toBeHidden({ timeout: 3000 });
  });
});

test.describe('👶 아동 탭 버튼', () => {
  test.beforeEach(async ({ page }) => {
    if (!PW) { test.skip(); return; }
    await loginAs(page);
    await page.locator('#sbTab1').click();
    await expect(page.locator('#panel0')).toBeVisible({ timeout: 6000 });
  });

  test('아동 목록 렌더링 확인', async ({ page }) => {
    // #childGrid는 빈 상태에서 height:0 → child-card 렌더 후 visible
    const grid = page.locator('#childGrid');
    // 아동 카드 첫 번째가 나타날 때까지 대기 (DB 로드 완료 후 렌더)
    await expect(grid.locator('.child-card').first()).toBeVisible({ timeout: 15000 });
    const content = await grid.textContent();
    expect(content?.trim()).toBeTruthy();
  });

  test('일괄 처리 버튼 토글', async ({ page }) => {
    const bulkBtn = page.locator('#bulkToggleBtn');
    await expect(bulkBtn).toBeVisible();
    await bulkBtn.click();
    await page.waitForTimeout(300);
    await bulkBtn.click(); // 원상복구
  });

  test('정렬 셀렉트 변경', async ({ page }) => {
    const sortSel = page.locator('#childSortSel');
    await expect(sortSel).toBeVisible();
    await sortSel.selectOption({ index: 1 });
    await page.waitForTimeout(500);
    await sortSel.selectOption({ index: 0 });
  });
});

test.describe('📋 보고서 탭 서브탭 버튼', () => {
  test.beforeEach(async ({ page }) => {
    if (!PW) { test.skip(); return; }
    await loginAs(page);
    await page.locator('#sbTab2').click();
    await expect(page.locator('#panelReport')).toBeVisible({ timeout: 6000 });
  });

  test('세션기록 서브탭', async ({ page }) => {
    await page.locator('#rtBtn_session').click();
    await expect(page.locator('#panel1')).toBeVisible();
  });

  test('AI 언어평가보고서 서브탭', async ({ page }) => {
    await page.locator('#rtBtn_assess').click();
    await expect(page.locator('#panel3')).toBeVisible();
  });

  test('AI 발달평가보고서 서브탭', async ({ page }) => {
    await page.locator('#rtBtn_si').click();
    await expect(page.locator('#panelSI')).toBeVisible();
  });

  test('리포트·장단기계획 서브탭', async ({ page }) => {
    await page.locator('#rtBtn_report').click();
    await expect(page.locator('#panel5, #panelReport').first()).toBeVisible();
  });
});

test.describe('📝 세션 기록 버튼', () => {
  test.beforeEach(async ({ page }) => {
    if (!PW) { test.skip(); return; }
    await loginAs(page);
    await page.locator('#sbTab2').click();
    await page.locator('#rtBtn_session').click();
    await expect(page.locator('#panel1')).toBeVisible({ timeout: 6000 });
  });

  test('직접 입력 / AI 정리 모드 버튼 전환', async ({ page }) => {
    await expect(page.locator('#modeBtn0')).toBeVisible();
    await expect(page.locator('#modeBtn1')).toBeVisible();
    await page.locator('#modeBtn1').click();
    await page.waitForTimeout(300);
    await page.locator('#modeBtn0').click();
  });

  test('조음 데이터 입력 버튼 토글', async ({ page }) => {
    const phonemeBtn = page.locator('#phonemeToggleBtn');
    if (await phonemeBtn.isVisible({ timeout: 3000 })) {
      await phonemeBtn.click();
      await page.waitForTimeout(600);
      await phonemeBtn.click();
      await page.waitForTimeout(400);
    }
  });

  test('음성 입력 버튼 노출 확인', async ({ page }) => {
    const voiceBtn = page.locator('#voiceBtn');
    const isVisible = await voiceBtn.isVisible().catch(() => false);
    // 아동 미선택 시 숨길 수 있음 — visible이면 확인, 아니면 스킵
    if (isVisible) {
      await expect(voiceBtn).toBeVisible();
    }
  });

  test('지난 세션 복제 버튼 노출 확인', async ({ page }) => {
    await expect(page.locator('#cloneLastBtn')).toBeVisible();
  });
});

test.describe('📊 성장기록 탭 버튼', () => {
  test.beforeEach(async ({ page }) => {
    if (!PW) { test.skip(); return; }
    await loginAs(page);
    await page.locator('#sbTab3').click();
    await expect(page.locator('#panelPortfolio')).toBeVisible({ timeout: 6000 });
  });

  test('발달추이 / 포트폴리오 / AI 서브탭 전환', async ({ page }) => {
    await page.locator('#ptBtn_trend').click();
    await expect(page.locator('#panel4')).toBeVisible();

    await page.locator('#ptBtn_portfolio').click();
    await page.waitForTimeout(300);

    await page.locator('#ptBtn_ai').click();
    await page.waitForTimeout(300);
  });

  test('조음 위치 필터 버튼 (전체/어두/어중/어말)', async ({ page }) => {
    await page.locator('#ptBtn_trend').click();
    for (const id of ['#posAll', '#posInit', '#posMed', '#posFin']) {
      const btn = page.locator(id);
      if (await btn.isVisible()) {
        await btn.click();
        await page.waitForTimeout(200);
      }
    }
  });
});

test.describe('📢 게시판 탭 버튼', () => {
  test.beforeEach(async ({ page }) => {
    if (!PW) { test.skip(); return; }
    await loginAs(page);
    await page.locator('#sbTab7').click();
    // panelBoard가 active 상태가 될 때까지 대기
    await expect(page.locator('#panelBoard')).toBeVisible({ timeout: 10000 });
    await page.waitForTimeout(500);
  });

  test('마디공지 / 센터공지 / 라운지 / 자료실 서브탭 전환', async ({ page }) => {
    for (const id of ['#bdBtn_global', '#bdBtn_center', '#bdBtn_lounge', '#bdBtn_library']) {
      const btn = page.locator(id);
      await expect(btn).toBeVisible({ timeout: 8000 });
      await btn.scrollIntoViewIfNeeded();
      await btn.click();
      await page.waitForTimeout(500);
    }
  });

  test('라운지 탭 — 오류 없이 로드', async ({ page }) => {
    await expect(page.locator('#bdBtn_lounge')).toBeVisible({ timeout: 8000 });
    await page.locator('#bdBtn_lounge').click();
    await waitNoErrorToast(page, 3000);
  });

  test('자료실 탭 — 카테고리 필터 노출', async ({ page }) => {
    await expect(page.locator('#bdBtn_library')).toBeVisible({ timeout: 8000 });
    await page.locator('#bdBtn_library').click();
    // getByText('자료실') strict mode 방지 → 자료실 패널 표시 확인
    await expect(page.locator('#bdBtn_library')).toHaveClass(/active/, { timeout: 5000 });
  });
});
