import { test, expect } from '@playwright/test';

test.describe('Doctor Tasks Page', () => {
  // 의사 계정으로 로그인
  test.beforeEach(async ({ page }) => {
    // doctor_parksh 의사 계정으로 테스트
    await page.goto('/login');
    await page.getByLabel('아이디').fill('0052');
    await page.getByLabel('비밀번호').fill('y8vawp0t');
    await page.getByRole('button', { name: '로그인' }).click();

    // 로그인 완료 대기
    await page.waitForURL(/\/(admin|staff|doctor|nurse)/, { timeout: 10000 });

    // 로그인 확인
    await page.waitForLoadState('networkidle');
  });

  test('should display doctor tasks page', async ({ page }) => {
    // 처리 필요 항목 페이지로 이동
    await page.goto('/doctor/tasks');

    // 페이지 제목 확인
    await expect(page.getByRole('heading', { name: '처리 필요 항목' })).toBeVisible({ timeout: 10000 });

    // 통계 카드에 '건' 텍스트가 있는지 확인
    await expect(page.getByText(/\d+건/).first()).toBeVisible();

    // 메인 탭 확인 (전체, 지시사항, 전달사항)
    await expect(page.getByRole('tab', { name: '전체' }).first()).toBeVisible();
    await expect(page.getByRole('tab', { name: '지시사항' }).first()).toBeVisible();
    await expect(page.getByRole('tab', { name: '전달사항' }).first()).toBeVisible();

    console.log('Doctor tasks page loaded successfully');
  });

  test('should switch between tabs', async ({ page }) => {
    await page.goto('/doctor/tasks');

    // 페이지 로드 대기
    await expect(page.getByRole('heading', { name: '처리 필요 항목' })).toBeVisible({ timeout: 10000 });

    // 지시사항 탭 클릭
    await page.getByRole('tab', { name: '지시사항' }).first().click();
    await expect(page.getByRole('tab', { name: '지시사항' }).first()).toHaveAttribute('data-state', 'active');

    // 전달사항 탭 클릭
    await page.getByRole('tab', { name: '전달사항' }).first().click();
    await expect(page.getByRole('tab', { name: '전달사항' }).first()).toHaveAttribute('data-state', 'active');

    // 전체 탭으로 복귀
    await page.getByRole('tab', { name: '전체' }).first().click();
    await expect(page.getByRole('tab', { name: '전체' }).first()).toHaveAttribute('data-state', 'active');

    console.log('Tab switching works correctly');
  });

  test('should have refresh button', async ({ page }) => {
    await page.goto('/doctor/tasks');

    // 페이지 로드 대기
    await expect(page.getByRole('heading', { name: '처리 필요 항목' })).toBeVisible({ timeout: 10000 });

    // 새로고침 버튼 확인
    const refreshButton = page.getByRole('button', { name: '새로고침' });
    await expect(refreshButton).toBeVisible();

    // 새로고침 버튼 클릭
    await refreshButton.click();

    // 페이지가 여전히 정상 표시되는지 확인
    await expect(page.getByRole('heading', { name: '처리 필요 항목' })).toBeVisible();

    console.log('Refresh button works correctly');
  });
});
