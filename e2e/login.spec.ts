import { test, expect } from '@playwright/test';

test.describe('Login Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
  });

  test('should display login form', async ({ page }) => {
    // Check form elements are visible
    await expect(page.getByRole('heading', { name: '로그인' })).toBeVisible();
    await expect(page.getByLabel('아이디')).toBeVisible();
    await expect(page.getByLabel('비밀번호')).toBeVisible();
    await expect(page.getByRole('button', { name: '로그인' })).toBeVisible();
  });

  test('should require fields before submission (HTML validation)', async ({ page }) => {
    // HTML5 required attribute prevents form submission without input
    const idInput = page.getByLabel('아이디');
    const submitButton = page.getByRole('button', { name: '로그인' });

    // Try to submit - browser validation should prevent it
    await submitButton.click();

    // Check that the ID field is still focused or has validation state
    // The form should not navigate away
    await expect(page).toHaveURL(/\/login/);

    // ID input should be required
    await expect(idInput).toHaveAttribute('required', '');
  });

  test('should show error for invalid credentials', async ({ page }) => {
    await page.getByLabel('아이디').fill('invalid_user');
    await page.getByLabel('비밀번호').fill('wrong_password');
    await page.getByRole('button', { name: '로그인' }).click();

    // Wait for error message
    await expect(
      page.getByText(/아이디 또는 비밀번호를 다시 확인|잘못된 아이디 또는 비밀번호|로그인 처리 중 오류/)
    ).toBeVisible({ timeout: 10000 });
  });
});
