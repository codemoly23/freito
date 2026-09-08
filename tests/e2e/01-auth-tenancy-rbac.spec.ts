import { test, expect } from '@playwright/test';
import { loginAsCompanyAdmin, loginAsPlatformOwner, loginAsClientPortalUser, waitForHydration } from './helpers/auth';

test.describe('Auth, Tenancy and RBAC', () => {
  test('Company Admin can login and access dashboard', async ({ page }) => {
    await loginAsCompanyAdmin(page);
  });

  test('Platform Owner can login and access platform', async ({ page }) => {
    await loginAsPlatformOwner(page);
  });

  test('Client Portal user can login and access portal', async ({ page }) => {
    await loginAsClientPortalUser(page, 'demo-freight');
  });

  test('Platform user cannot access company dashboard', async ({ page }) => {
    await loginAsPlatformOwner(page);
    await page.goto('/dashboard');
    // If user.scope is PLATFORM but scope is COMPANY, it redirects to company login with wrong-portal error
    await expect(page).toHaveURL(/\/login(?:\?error=wrong-portal)?$/);
  });

  test('Company user cannot access platform', async ({ page }) => {
    await loginAsCompanyAdmin(page);
    await page.goto('/platform');
    // If user.scope is COMPANY but scope is PLATFORM, it redirects to platform login with wrong-portal error
    await expect(page).toHaveURL(/\/platform-login(?:\?error=wrong-portal)?$/);
  });

  test('Anonymous user is redirected to login', async ({ page }) => {
    await page.goto('/dashboard');
    await expect(page).toHaveURL(/\/login/);
    
    await page.goto('/platform');
    await expect(page).toHaveURL(/\/platform-login/);
    
    await page.goto('/portal/demo-freight');
    await expect(page).toHaveURL(/\/portal-login/);
  });

  test('Wrong credentials show error message', async ({ page }) => {
    await page.goto('/login');
    await waitForHydration(page);
    await page.fill('input[id="email"]', 'wrong@example.com');
    await page.fill('input[id="password"]', 'wrongpassword');
    await page.click('button[type="submit"]');
    await expect(page.locator('text=Invalid email or password')).toBeVisible();
  });
});
