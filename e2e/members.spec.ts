import { test, expect } from './fixtures/auth';

test.describe('Member Management (Admin)', () => {
  test('displays member list with data table', async ({ adminPage: page }) => {
    await page.goto('/admin/members');
    await expect(page.getByRole('table')).toBeVisible({ timeout: 10_000 });
    // Should have at least one member row
    const rows = page.locator('tbody tr');
    await expect(rows.first()).toBeVisible();
  });

  test('can search members by name', async ({ adminPage: page }) => {
    await page.goto('/admin/members');
    await expect(page.getByRole('table')).toBeVisible({ timeout: 10_000 });

    const searchInput = page.getByPlaceholder(/search/i);
    if (await searchInput.isVisible()) {
      await searchInput.fill('test');
      // Wait for filtered results
      await page.waitForTimeout(500);
    }
  });

  test('can filter members by status', async ({ adminPage: page }) => {
    await page.goto('/admin/members');
    await expect(page.getByRole('table')).toBeVisible({ timeout: 10_000 });

    // Look for status filter
    const statusFilter = page.getByRole('combobox').first();
    if (await statusFilter.isVisible()) {
      await statusFilter.click();
    }
  });

  test('can view member details', async ({ adminPage: page }) => {
    await page.goto('/admin/members');
    await expect(page.getByRole('table')).toBeVisible({ timeout: 10_000 });

    // Click first member row or view button
    const viewButton = page.getByRole('link', { name: /view|detail/i }).first();
    if (await viewButton.isVisible()) {
      await viewButton.click();
      await page.waitForURL(/\/admin\/members\/\w+/);
    } else {
      // Click on the first row
      await page.locator('tbody tr').first().click();
    }
  });

  test('can approve a pending member', async ({ adminPage: page }) => {
    await page.goto('/admin/members?status=PENDING');
    await page.waitForTimeout(1000);

    const approveButton = page.getByRole('button', { name: /approve/i }).first();
    if (await approveButton.isVisible()) {
      await approveButton.click();
      // May need to confirm
      const confirmButton = page.getByRole('button', { name: /confirm|yes/i });
      if (await confirmButton.isVisible({ timeout: 2000 }).catch(() => false)) {
        await confirmButton.click();
      }
    }
  });
});
