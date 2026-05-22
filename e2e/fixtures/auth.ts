import { test as base, expect, type Page } from '@playwright/test';

// Admin credentials (from seed data — apps/backend/src/db/seed.ts)
const ADMIN_EMAIL = 'admin@example.org';
const ADMIN_PASSWORD = 'AdminPass123!';

export async function loginAsAdmin(page: Page) {
  await page.goto('/admin/login');
  await page.getByLabel('Email').fill(ADMIN_EMAIL);
  await page.getByLabel('Password').fill(ADMIN_PASSWORD);
  await page.getByRole('button', { name: /sign in/i }).click();
  await page.waitForURL('/admin/dashboard');
}

export async function loginAsMember(page: Page) {
  await page.goto('/login');
  // Use demo login if available
  const demoButton = page.getByRole('button', { name: /demo/i });
  if (await demoButton.isVisible()) {
    await demoButton.click();
    await page.waitForURL('/member/dashboard');
  }
}

// Extended test fixture with pre-authenticated contexts
export const test = base.extend<{ adminPage: Page; memberPage: Page }>({
  adminPage: async ({ browser }, use) => {
    const context = await browser.newContext();
    const page = await context.newPage();
    await loginAsAdmin(page);
    await use(page);
    await context.close();
  },
  memberPage: async ({ browser }, use) => {
    const context = await browser.newContext();
    const page = await context.newPage();
    await loginAsMember(page);
    await use(page);
    await context.close();
  },
});

export { expect };
