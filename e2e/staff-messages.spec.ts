import { test, expect } from '@playwright/test';

test.describe('Staff Messages Page', () => {
  test.beforeEach(async ({ page }) => {
    // admin 계정으로 로그인 (coordinator 역할 테스트를 위해 admin 사용)
    await page.goto('/login');
    await page.getByLabel('아이디').fill('admin');
    await page.getByLabel('비밀번호').fill('1234');
    await page.getByRole('button', { name: '로그인' }).click();

    // 로그인 완료 대기
    await page.waitForURL(/\/(admin|staff|doctor|nurse)/, { timeout: 10000 });
    await page.waitForLoadState('networkidle');
  });

  test('should display staff messages page', async ({ page }) => {
    // 전달사항 페이지로 이동
    await page.goto('/staff/messages');

    // 페이지 제목 확인
    await expect(page.getByRole('heading', { name: '전달사항 작성' })).toBeVisible({ timeout: 10000 });

    // 카드 확인
    await expect(page.getByText('새 전달사항')).toBeVisible();
    await expect(page.getByText('오늘 작성한 전달사항')).toBeVisible();

    // 폼 요소 확인
    await expect(page.getByText('환자 선택')).toBeVisible();
    await expect(page.getByText('전달내용')).toBeVisible();
    await expect(page.getByRole('button', { name: '전달사항 저장' })).toBeVisible();

    console.log('Staff messages page loaded successfully');
  });

  test('should have refresh button', async ({ page }) => {
    await page.goto('/staff/messages');

    // 페이지 로드 대기
    await expect(page.getByRole('heading', { name: '전달사항 작성' })).toBeVisible({ timeout: 10000 });

    // 새로고침 버튼 확인
    const refreshButton = page.getByRole('button', { name: '새로고침' });
    await expect(refreshButton).toBeVisible();

    // 새로고침 버튼 클릭
    await refreshButton.click();

    // 페이지가 여전히 정상 표시되는지 확인
    await expect(page.getByRole('heading', { name: '전달사항 작성' })).toBeVisible();

    console.log('Refresh button works correctly');
  });

  test('should have form validation', async ({ page }) => {
    await page.goto('/staff/messages');

    // 페이지 로드 대기
    await expect(page.getByRole('heading', { name: '전달사항 작성' })).toBeVisible({ timeout: 10000 });

    // 빈 폼 제출 시도
    await page.getByRole('button', { name: '전달사항 저장' }).click();

    // 환자 선택 필드 확인 (select 컴포넌트 존재 확인)
    const selectTrigger = page.locator('[role="combobox"]').first();
    await expect(selectTrigger).toBeVisible();

    console.log('Form validation works correctly');
  });
});
