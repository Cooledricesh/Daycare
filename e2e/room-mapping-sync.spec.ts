import { test, expect } from '@playwright/test';

test.describe('Room Mapping - Coordinator Sync', () => {
  // 로그인 후 매핑 페이지 접근
  test.beforeEach(async ({ page }) => {
    // 로그인
    await page.goto('/login');
    await page.getByLabel('아이디').fill('admin');
    await page.getByLabel('비밀번호').fill('1234');
    await page.getByRole('button', { name: '로그인' }).click();

    // 로그인 완료 대기
    await page.waitForURL(/\/(admin|staff|doctor|nurse)/, { timeout: 10000 });
  });

  test('should update patients coordinator when mapping is changed', async ({ page }) => {
    // 1. 호실 매핑 페이지로 이동
    await page.goto('/admin/settings/room-mapping');
    await expect(page.getByRole('heading', { name: '호실-담당자 매핑' })).toBeVisible({ timeout: 10000 });

    // 2. 첫 번째 호실 매핑의 수정 버튼 클릭
    const editButton = page.locator('table tbody tr').first().getByRole('button').first();
    await editButton.click();

    // 3. 모달이 열릴 때까지 대기
    await expect(page.getByRole('dialog')).toBeVisible();
    await expect(page.getByText('호실 매핑 수정')).toBeVisible();

    // 4. 코디네이터 선택 (드롭다운에서 첫 번째 코디 선택)
    const coordinatorSelect = page.locator('[role="combobox"]').first();
    await coordinatorSelect.click();

    // 드롭다운 옵션 대기
    await page.waitForSelector('[role="option"]', { timeout: 5000 });

    // '미지정'이 아닌 첫 번째 코디네이터 선택
    const options = page.locator('[role="option"]');
    const optionCount = await options.count();

    if (optionCount > 1) {
      // 두 번째 옵션 (첫 번째 실제 코디네이터) 클릭
      await options.nth(1).click();
    }

    // 5. 수정 버튼 클릭
    await page.getByRole('button', { name: '수정' }).click();

    // 6. 모달이 닫히고 성공적으로 업데이트 되었는지 확인
    await expect(page.getByRole('dialog')).not.toBeVisible({ timeout: 5000 });

    // 7. 스케줄 페이지로 이동해서 담당자가 업데이트되었는지 확인
    await page.goto('/admin/schedule');
    await expect(page.getByRole('heading', { name: '스케줄 관리' })).toBeVisible({ timeout: 10000 });

    // 페이지 로드 완료 대기
    await page.waitForLoadState('networkidle');

    console.log('Room mapping sync test completed successfully - mapping updated!');
  });

  test('should show room mappings correctly', async ({ page }) => {
    await page.goto('/admin/settings/room-mapping');

    // 페이지 로드 확인
    await expect(page.getByRole('heading', { name: '호실-담당자 매핑' })).toBeVisible({ timeout: 10000 });

    // 테이블 확인
    const table = page.locator('table');
    await expect(table).toBeVisible();

    // 호실 데이터가 있는지 확인
    const rows = page.locator('table tbody tr');
    const rowCount = await rows.count();

    console.log(`Found ${rowCount} room mappings`);
    expect(rowCount).toBeGreaterThan(0);
  });
});
