import { test, expect } from '@playwright/test';

test.describe('Home Page', () => {
  test('should display main navigation options', async ({ page }) => {
    await page.goto('/');

    // Check main heading
    await expect(page.getByRole('heading', { name: '낮병원 관리 시스템' })).toBeVisible();
    await expect(page.getByText('환자 출석 및 진찰 관리')).toBeVisible();

    // Check navigation links
    await expect(page.getByRole('link', { name: '환자용 출석 체크' })).toBeVisible();
    await expect(page.getByRole('link', { name: '직원 / 의사 로그인' })).toBeVisible();
  });

  test('should navigate to patient check-in page', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('link', { name: '환자용 출석 체크' }).click();
    await expect(page).toHaveURL('/patient');
  });

  test('should navigate to login page', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('link', { name: '직원 / 의사 로그인' }).click();
    await expect(page).toHaveURL('/login');
  });
});
