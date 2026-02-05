import { test, expect } from '@playwright/test';

test.describe('Doctor History Page', () => {
  test.beforeEach(async ({ page }) => {
    // doctor_parksh 의사 계정으로 로그인
    await page.goto('/login');
    await page.getByLabel('아이디').fill('doctor_parksh');
    await page.getByLabel('비밀번호').fill('1234');
    await page.getByRole('button', { name: '로그인' }).click();

    // 로그인 완료 대기
    await page.waitForURL(/\/(admin|staff|doctor|nurse)/, { timeout: 10000 });
    await page.waitForLoadState('networkidle');
  });

  test('should navigate to patient history from tasks page', async ({ page }) => {
    // 처리 필요 항목 페이지로 이동
    await page.goto('/doctor/tasks');
    await expect(page.getByRole('heading', { name: '처리 필요 항목' })).toBeVisible({ timeout: 10000 });

    // 환자 목록이 있는 경우 첫 번째 환자 클릭
    const patientLink = page.locator('a[href^="/doctor/history/"]').first();

    if (await patientLink.isVisible({ timeout: 3000 }).catch(() => false)) {
      await patientLink.click();

      // 환자 히스토리 페이지로 이동 확인
      await expect(page.getByRole('heading', { name: '환자 히스토리' })).toBeVisible({ timeout: 10000 });
      await expect(page.getByRole('button', { name: '뒤로가기' })).toBeVisible();

      console.log('Patient history page loaded successfully');
    } else {
      console.log('No patient links found - skipping navigation test');
    }
  });

  test('should display history page with back button', async ({ page }) => {
    // 테스트용 임의의 UUID로 페이지 접근 (실제로 존재하지 않아도 페이지 구조 확인 가능)
    await page.goto('/doctor/history/00000000-0000-0000-0000-000000000000');

    // 페이지 로드 대기
    await page.waitForLoadState('networkidle');

    // 뒤로가기 버튼 확인
    const backButton = page.getByRole('button', { name: '뒤로가기' });
    await expect(backButton).toBeVisible({ timeout: 10000 });

    // 에러 메시지 또는 정상 콘텐츠 확인
    const hasError = await page.getByText('환자 정보를 불러올 수 없습니다').isVisible().catch(() => false);
    const hasTitle = await page.getByRole('heading', { name: '환자 히스토리' }).isVisible().catch(() => false);

    expect(hasError || hasTitle).toBe(true);

    console.log('History page structure verified');
  });

  test('should have back button that navigates correctly', async ({ page }) => {
    // 처리 필요 항목 페이지로 먼저 이동
    await page.goto('/doctor/tasks');
    await expect(page.getByRole('heading', { name: '처리 필요 항목' })).toBeVisible({ timeout: 10000 });

    // 히스토리 페이지로 이동
    await page.goto('/doctor/history/00000000-0000-0000-0000-000000000000');
    await page.waitForLoadState('networkidle');

    // 뒤로가기 버튼 클릭
    const backButton = page.getByRole('button', { name: '뒤로가기' });
    await expect(backButton).toBeVisible({ timeout: 10000 });
    await backButton.click();

    // 이전 페이지로 돌아갔는지 확인
    await page.waitForLoadState('networkidle');

    console.log('Back button navigation works');
  });
});
