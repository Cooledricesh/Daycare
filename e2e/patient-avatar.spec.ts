import { test, expect } from '@playwright/test';

test.describe('Patient Avatar', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('아이디').fill('admin');
    await page.getByLabel('비밀번호').fill('1234');
    await page.getByRole('button', { name: '로그인' }).click();

    await page.waitForURL(/\/(admin|staff|doctor|nurse)/, { timeout: 10000 });
    await page.waitForLoadState('networkidle');
  });

  test('should display admin dashboard with patient list', async ({ page }) => {
    await page.goto('/admin/dashboard');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    await expect(page).toHaveURL(/\/admin\/dashboard/);

    // 환자 목록 버튼이 렌더링되는지 확인
    const patientButtons = page.locator('button.w-full.text-left');
    const count = await patientButtons.count();
    expect(count).toBeGreaterThan(0);
  });

  test('should open patient detail panel when patient is clicked', async ({ page }) => {
    await page.goto('/admin/dashboard');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    const patientButton = page.locator('button.w-full.text-left').first();
    await patientButton.click();
    await page.waitForTimeout(1000);

    // 상세 패널에 환자 이름이 표시되는지 확인
    const patientNameHeading = page.locator('h2.text-xl.font-bold').first();
    await expect(patientNameHeading).toBeVisible({ timeout: 5000 });

    // 연필 아이콘 버튼(DisplayNameEditButton)이 나타나는지 확인
    const pencilButton = page.locator('button:has(.lucide-pencil)');
    await expect(pencilButton).toBeVisible({ timeout: 5000 });
  });

  test('should open profile edit dialog and show correct title', async ({ page }) => {
    await page.goto('/admin/dashboard');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    // 환자 클릭하여 상세 패널 열기
    const patientButton = page.locator('button.w-full.text-left').first();
    await patientButton.click();
    await page.waitForTimeout(1000);

    // 연필 아이콘 버튼 클릭
    const pencilButton = page.locator('button:has(.lucide-pencil)');
    await expect(pencilButton).toBeVisible({ timeout: 5000 });
    await pencilButton.click();

    // 다이얼로그 제목 확인 - 새 제목 "환자 프로필 편집"
    await expect(page.getByRole('heading', { name: '환자 프로필 편집' })).toBeVisible({ timeout: 5000 });
  });

  test('should show camera icon and photo change button in edit dialog', async ({ page }) => {
    await page.goto('/admin/dashboard');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    const patientButton = page.locator('button.w-full.text-left').first();
    await patientButton.click();
    await page.waitForTimeout(1000);

    const pencilButton = page.locator('button:has(.lucide-pencil)');
    await expect(pencilButton).toBeVisible({ timeout: 5000 });
    await pencilButton.click();

    // 다이얼로그 제목 및 설명 확인
    await expect(page.getByRole('heading', { name: '환자 프로필 편집' })).toBeVisible({ timeout: 5000 });
    await expect(page.getByText('프로필 사진과 표시명을 변경합니다.')).toBeVisible();

    // "사진 변경" 버튼 확인 (Camera 아이콘 포함)
    await expect(page.getByRole('button', { name: '사진 변경' })).toBeVisible();

    // "표시명" 레이블 확인
    await expect(page.getByLabel('표시명')).toBeVisible();

    // "저장" 버튼 확인
    await expect(page.getByRole('button', { name: '저장' })).toBeVisible();
  });

  test('should have file input with correct accept attribute in edit dialog', async ({ page }) => {
    await page.goto('/admin/dashboard');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    const patientButton = page.locator('button.w-full.text-left').first();
    await patientButton.click();
    await page.waitForTimeout(1000);

    const pencilButton = page.locator('button:has(.lucide-pencil)');
    await expect(pencilButton).toBeVisible({ timeout: 5000 });
    await pencilButton.click();

    // 다이얼로그 열림 대기
    await expect(page.getByRole('heading', { name: '환자 프로필 편집' })).toBeVisible({ timeout: 5000 });

    // hidden file input의 accept 속성 확인 (jpeg, png, webp 허용)
    const fileInput = page.locator('input[type="file"]');
    await expect(fileInput).toHaveAttribute('accept', 'image/jpeg,image/png,image/webp');
  });

  test('should not show old dialog title', async ({ page }) => {
    await page.goto('/admin/dashboard');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    const patientButton = page.locator('button.w-full.text-left').first();
    await patientButton.click();
    await page.waitForTimeout(1000);

    const pencilButton = page.locator('button:has(.lucide-pencil)');
    await expect(pencilButton).toBeVisible({ timeout: 5000 });
    await pencilButton.click();

    // 새 제목 확인
    await expect(page.getByRole('heading', { name: '환자 프로필 편집' })).toBeVisible({ timeout: 5000 });

    // 이전 제목("환자 표시명 변경")이 없어야 함
    await expect(page.getByRole('heading', { name: '환자 표시명 변경' })).not.toBeVisible();
  });

  test('should close dialog when Escape key is pressed', async ({ page }) => {
    await page.goto('/admin/dashboard');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    const patientButton = page.locator('button.w-full.text-left').first();
    await patientButton.click();
    await page.waitForTimeout(1000);

    const pencilButton = page.locator('button:has(.lucide-pencil)');
    await expect(pencilButton).toBeVisible({ timeout: 5000 });
    await pencilButton.click();

    // 다이얼로그 열림 확인
    await expect(page.getByRole('heading', { name: '환자 프로필 편집' })).toBeVisible({ timeout: 5000 });

    // Escape 키로 다이얼로그 닫기
    await page.keyboard.press('Escape');

    // 다이얼로그가 닫히는지 확인
    await expect(page.getByRole('heading', { name: '환자 프로필 편집' })).not.toBeVisible({ timeout: 3000 });
  });
});
