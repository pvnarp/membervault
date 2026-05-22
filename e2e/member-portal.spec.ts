import { test, expect } from './fixtures/auth';

test.describe('Member Portal', () => {
  test('member dashboard shows status info', async ({ memberPage: page }) => {
    await page.goto('/member/dashboard');
    await expect(page.getByText(/status|membership/i).first()).toBeVisible({ timeout: 10_000 });
  });

  test('member profile page loads', async ({ memberPage: page }) => {
    await page.goto('/member/profile');
    await expect(page.getByText(/profile|email|phone/i).first()).toBeVisible({ timeout: 10_000 });
  });

  test('voting history page loads', async ({ memberPage: page }) => {
    await page.goto('/member/voting-history');
    await expect(page.getByText(/voting|history|election/i).first()).toBeVisible({
      timeout: 10_000,
    });
  });

  test('member can navigate between sections', async ({ memberPage: page }) => {
    await page.goto('/member/dashboard');
    await page.waitForTimeout(1000);

    // Navigate to profile
    const profileLink = page.getByRole('link', { name: /profile/i }).first();
    if (await profileLink.isVisible()) {
      await profileLink.click();
      await page.waitForURL('/member/profile');
    }
  });
});
