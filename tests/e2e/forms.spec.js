// @ts-check
/**
 * forms.spec.js — 폼 입력·유효성·저장 E2E 테스트
 * 실행: TEST_PASSWORD=비밀번호 npx playwright test forms
 */
const { test, expect } = require('@playwright/test');
const { loginAs, waitNoErrorToast, PW } = require('./helpers');

test.describe('🔐 회원가입 폼 유효성', () => {
  test('회원가입 버튼 클릭 → 가입 폼 표시', async ({ page }) => {
    await page.context().clearCookies();
    await page.goto('/MADI/');
    await page.getByRole('button', { name: '로그인' }).first().click();
    // 회원가입 링크 찾기
    const signupLink = page.getByText('회원가입').or(page.locator('[onclick*="showSignupScreen"]')).first();
    if (await signupLink.isVisible({ timeout: 3000 })) {
      await signupLink.click();
      await expect(page.locator('#signupScreen')).toBeVisible({ timeout: 5000 });
      await expect(page.locator('#signupSubmitBtn')).toBeVisible();
    } else {
      test.skip();
    }
  });
});

test.describe('📅 일정 추가 폼', () => {
  test.beforeEach(async ({ page }) => {
    if (!PW) { test.skip(); return; }
    await loginAs(page);
    await page.locator('#sbTab0').click();
    await expect(page.locator('#panel2')).toBeVisible({ timeout: 6000 });
  });

  test('일정 추가 모달 — 필드 입력 후 닫기', async ({ page }) => {
    const addBtn = page.getByRole('button', { name: /일정 추가|추가|새 일정|\+/ }).first();
    if (!await addBtn.isVisible({ timeout: 3000 })) { test.skip(); return; }

    await addBtn.click();
    const modal = page.locator('#schedModal, [id*="schedModal"]').first();
    await expect(modal).toBeVisible({ timeout: 5000 });

    // 제목 입력 시도
    const titleInput = modal.locator('input[type="text"]').first();
    if (await titleInput.isVisible()) {
      await titleInput.fill('테스트 일정');
    }

    // 닫기 버튼
    const closeBtn = modal.getByText('닫기').or(modal.getByText('취소')).first();
    if (await closeBtn.isVisible()) {
      await closeBtn.click();
      await expect(modal).toBeHidden({ timeout: 3000 });
    }
  });

  test('내보내기 폼 — 날짜 범위 입력', async ({ page }) => {
    await page.locator('button[onclick="openScheduleExportModal()"]').click();
    await page.waitForTimeout(500);

    const modal = page.locator('#schedExportModal');
    await expect(modal).toBeVisible();

    await page.fill('#exportDateFrom', '2026-05-01');
    await page.fill('#exportDateTo', '2026-05-31');

    const val = await page.locator('#exportDateFrom').inputValue();
    expect(val).toBe('2026-05-01');

    // 닫기
    await modal.getByText('닫기').click();
    await expect(modal).toBeHidden({ timeout: 3000 });
  });
});

test.describe('📝 세션 기록 폼', () => {
  test.beforeEach(async ({ page }) => {
    if (!PW) { test.skip(); return; }
    await loginAs(page);
    await page.locator('#sbTab2').click();
    await page.locator('#rtBtn_session').click();
    await expect(page.locator('#panel1')).toBeVisible({ timeout: 6000 });
    await page.waitForTimeout(1500); // DB 로드 대기
  });

  test('아동 선택 셀렉트 — 옵션 존재', async ({ page }) => {
    const sel = page.locator('#schedChildSel, [id*="ChildSel"]').first();
    if (await sel.isVisible({ timeout: 3000 })) {
      const options = await sel.locator('option').count();
      expect(options).toBeGreaterThan(0);
    }
  });

  test('날짜 입력 필드 — 기본값 존재', async ({ page }) => {
    const dateInput = page.locator('#sessionDate');
    if (await dateInput.isVisible({ timeout: 3000 })) {
      const val = await dateInput.inputValue();
      expect(val).toBeTruthy(); // 기본 날짜가 채워져야 함
    }
  });

  test('세션 내용 텍스트 영역 — 입력 가능', async ({ page }) => {
    const textarea = page.locator('#sessionContent, textarea[id*="session"]').first();
    if (await textarea.isVisible({ timeout: 3000 })) {
      await textarea.fill('테스트 세션 내용입니다.');
      const val = await textarea.inputValue();
      expect(val).toContain('테스트');
      await textarea.fill(''); // 초기화
    }
  });
});

test.describe('👶 아동 추가 모달 폼', () => {
  test.beforeEach(async ({ page }) => {
    if (!PW) { test.skip(); return; }
    await loginAs(page);
    await page.locator('#sbTab1').click();
    await expect(page.locator('#panel0')).toBeVisible({ timeout: 6000 });
    await page.waitForTimeout(1500);
  });

  test('아동 추가 버튼 → 모달 오픈', async ({ page }) => {
    const addBtn = page.getByRole('button', { name: /아동 추가|새 아동|\+/ }).first();
    if (!await addBtn.isVisible({ timeout: 3000 })) { test.skip(); return; }

    await addBtn.click();
    const modal = page.locator('[id*="addChild"], [id*="childModal"]').first();
    await expect(modal).toBeVisible({ timeout: 5000 });

    // 닫기
    const closeBtn = modal.getByText('닫기').or(modal.getByText('취소')).first();
    if (await closeBtn.isVisible()) await closeBtn.click();
  });
});

test.describe('📋 AI 언어평가보고서 폼', () => {
  test.beforeEach(async ({ page }) => {
    if (!PW) { test.skip(); return; }
    await loginAs(page);
    await page.locator('#sbTab2').click();
    await page.locator('#rtBtn_assess').click();
    await expect(page.locator('#panel3')).toBeVisible({ timeout: 6000 });
    await page.waitForTimeout(1500);
  });

  test('자동 계산 버튼 — 클릭 시 오류 없음', async ({ page }) => {
    const calcBtn = page.locator('#autoCalcBtn');
    if (await calcBtn.isVisible({ timeout: 3000 })) {
      await calcBtn.click();
      await waitNoErrorToast(page, 2000);
    }
  });

  test('AI 평가 보고서 생성 버튼 — 존재 확인', async ({ page }) => {
    await expect(page.locator('#assessReportBtn')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('#assessReportBtn')).toBeEnabled({ timeout: 5000 });
  });
});

test.describe('🗑️ 삭제 확인 모달', () => {
  test.beforeEach(async ({ page }) => {
    if (!PW) { test.skip(); return; }
    await loginAs(page);
  });

  test('삭제 확인 모달 — 취소 버튼으로 닫기', async ({ page }) => {
    // 세션 목록에서 삭제 버튼 찾기
    await page.locator('#sbTab2').click();
    await page.locator('#rtBtn_session').click();
    await page.waitForTimeout(2000);

    const deleteBtn = page.locator('.btn-del').first();
    if (!await deleteBtn.isVisible({ timeout: 3000 })) { test.skip(); return; }

    await deleteBtn.click();
    const modal = page.locator('#deleteConfirmModal');
    await expect(modal).toBeVisible({ timeout: 5000 });

    // 취소 버튼으로 닫기 (삭제 안 함)
    const cancelBtn = modal.getByText('아니요').or(modal.getByText('취소')).first();
    await expect(cancelBtn).toBeVisible();
    await cancelBtn.click();
    await expect(modal).toBeHidden({ timeout: 3000 });
  });
});
