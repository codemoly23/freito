import { test, expect } from '@playwright/test';
import { loginAsPlatformOwner } from './helpers/auth';

test.describe('Platform SaaS and Modules', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsPlatformOwner(page);
  });

  test('Can view companies list', async ({ page }) => {
    await page.goto('/platform/companies');
    await expect(page.getByRole('heading', { name: 'Platform companies' })).toBeVisible();
  });

  test('Can view subscriptions', async ({ page }) => {
    await page.goto('/platform/subscriptions');
    await expect(page.locator('h1')).toContainText('Subscriptions');
  });

  test('Can view module access settings', async ({ page }) => {
    await page.goto('/platform/modules');
    await expect(page.getByRole('heading', { name: 'Module Access' })).toBeVisible();
  });

  test('Can view platform dashboard and audit', async ({ page }) => {
    await page.goto('/platform');
    await expect(page.getByRole('heading', { name: 'Operator dashboard' })).toBeVisible();
    await page.goto('/platform/audit');
    await expect(page.getByRole('heading', { name: 'Platform audit' })).toBeVisible();
  });

  test('Platform sidebar highlights only the current route and support works', async ({ page }) => {
    const routes = [
      ['/platform', 'Platform Dashboard'],
      ['/platform/companies', 'Companies'],
      ['/platform/subscriptions', 'Subscriptions / Licenses'],
      ['/platform/modules', 'Module Access'],
      ['/platform/audit', 'Platform Audit'],
      ['/platform/support', 'Support'],
    ] as const;

    for (const [route, label] of routes) {
      await page.goto(route);
      const activeLinks = page.locator('aside nav a[aria-current="page"]');
      await expect(activeLinks).toHaveCount(1);
      await expect(activeLinks).toHaveText(label);
    }

    await expect(page.getByRole('heading', { name: 'Support', exact: true })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Companies' })).not.toContainText('5.5');
  });
});
