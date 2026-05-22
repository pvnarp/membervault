import { test, expect } from './fixtures/auth';

test.describe('Admin Features', () => {
  test('dashboard shows stat cards and action items', async ({ adminPage: page }) => {
    await page.goto('/admin/dashboard');
    // Should have stat cards
    await expect(page.getByText(/total members|pending|voting/i).first()).toBeVisible({
      timeout: 10_000,
    });
  });

  test('admin users page loads', async ({ adminPage: page }) => {
    await page.goto('/admin/users');
    await expect(page.getByRole('heading')).toBeVisible({ timeout: 10_000 });
  });

  test('eligibility rules page loads', async ({ adminPage: page }) => {
    await page.goto('/admin/rules');
    await expect(page.getByRole('heading')).toBeVisible({ timeout: 10_000 });
  });

  test('audit log page loads with table', async ({ adminPage: page }) => {
    await page.goto('/admin/audit-log');
    await expect(page.getByRole('table')).toBeVisible({ timeout: 10_000 });
  });

  test('email templates page loads', async ({ adminPage: page }) => {
    await page.goto('/admin/email-templates');
    await expect(page.getByRole('heading')).toBeVisible({ timeout: 10_000 });
  });

  test('change requests page loads', async ({ adminPage: page }) => {
    await page.goto('/admin/change-requests');
    await expect(page.getByRole('heading')).toBeVisible({ timeout: 10_000 });
  });

  test('admin sidebar navigation works', async ({ adminPage: page }) => {
    await page.goto('/admin/dashboard');

    // Navigate to members
    const membersLink = page.getByRole('link', { name: /members/i }).first();
    if (await membersLink.isVisible()) {
      await membersLink.click();
      await page.waitForURL('/admin/members');
    }
  });
});
