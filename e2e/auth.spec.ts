import { test, expect } from '@playwright/test';

test.describe('Authentication', () => {
  test('shows registration page at root', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await expect(page.getByLabel('First Name')).toBeVisible();
  });

  test('shows login page with magic link form', async ({ page }) => {
    await page.goto('/login');
    await expect(page.getByLabel('Email')).toBeVisible();
    await expect(page.getByRole('button', { name: /magic link|sign in/i })).toBeVisible();
  });

  test('shows admin login page', async ({ page }) => {
    await page.goto('/admin/login');
    await expect(page.getByLabel('Email')).toBeVisible();
    await expect(page.getByLabel('Password')).toBeVisible();
  });

  test('admin login with valid credentials redirects to dashboard', async ({ page }) => {
    await page.goto('/admin/login');
    await page.getByLabel('Email').fill('admin@membership.org');
    await page.getByLabel('Password').fill('admin123456');
    await page.getByRole('button', { name: /sign in/i }).click();
    await page.waitForURL('/admin/dashboard', { timeout: 10_000 });
    await expect(page).toHaveURL('/admin/dashboard');
  });

  test('admin login with invalid credentials shows error', async ({ page }) => {
    await page.goto('/admin/login');
    await page.getByLabel('Email').fill('admin@membership.org');
    await page.getByLabel('Password').fill('wrongpassword123456');
    await page.getByRole('button', { name: /sign in/i }).click();
    await expect(page.getByText(/invalid|error|unauthorized/i)).toBeVisible({ timeout: 5000 });
  });

  test('unauthenticated user is redirected from admin routes', async ({ page }) => {
    await page.goto('/admin/dashboard');
    await page.waitForURL('/login');
    await expect(page).toHaveURL('/login');
  });

  test('unauthenticated user is redirected from member routes', async ({ page }) => {
    await page.goto('/member/dashboard');
    await page.waitForURL('/login');
    await expect(page).toHaveURL('/login');
  });
});
