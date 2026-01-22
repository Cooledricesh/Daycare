import { test, expect } from '@playwright/test';

test.describe('Protected Routes - Redirect to Login', () => {
  test('staff dashboard should redirect unauthenticated users to login', async ({ page }) => {
    await page.goto('/staff/dashboard');

    // Should redirect to login with redirectedFrom parameter
    await expect(page).toHaveURL(/\/login\?redirectedFrom/);
  });

  test('nurse prescriptions should redirect unauthenticated users to login', async ({ page }) => {
    await page.goto('/nurse/prescriptions');

    await expect(page).toHaveURL(/\/login\?redirectedFrom/);
  });

  test('admin patients should redirect unauthenticated users to login', async ({ page }) => {
    await page.goto('/admin/patients');

    await expect(page).toHaveURL(/\/login\?redirectedFrom/);
  });

  test('doctor consultation should redirect unauthenticated users to login', async ({ page }) => {
    await page.goto('/doctor/consultation');

    await expect(page).toHaveURL(/\/login\?redirectedFrom/);
  });
});
