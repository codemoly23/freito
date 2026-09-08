import { test, expect } from '@playwright/test';
import { loginAsClientPortalUser, loginAsCompanyAdmin, loginAsPlatformOwner } from './helpers/auth';

test.describe('Security Regression', () => {
  test('Portal customer is redirected to company login when accessing dashboard', async ({ page }) => {
    await loginAsClientPortalUser(page, 'demo-freight');
    await page.goto('/dashboard');
    await expect(page).toHaveURL(/\/login(?:\?error=wrong-portal)?$/);
    await expect(page).not.toHaveURL(/\/dashboard/);
  });

  test('Internal financial fields are not visible in portal', async ({ page }) => {
    await loginAsClientPortalUser(page, 'demo-freight');
    await page.goto('/portal/demo-freight/requests');
    
    // Check for sensitive text that should only be in dashboard
    const bodyText = await page.innerText('body');
    expect(bodyText).not.toContain('Internal Profit');
    expect(bodyText).not.toContain('Buy Cost');
    expect(bodyText).not.toContain('Margin');
  });

  test('Company user is redirected to portal login when accessing portal requests', async ({ page }) => {
    await loginAsCompanyAdmin(page);
    await page.goto('/portal/demo-freight/requests');
    await expect(page).toHaveURL(/\/portal-login(?:\?error=wrong-portal)?$/);
    await expect(page).not.toHaveURL(/\/portal\/demo-freight\/requests/);
  });

  test('Platform session does not auto-login on portal or company login pages', async ({ browser }) => {
    const context = await browser.newContext();
    const platformPage = await context.newPage();
    await loginAsPlatformOwner(platformPage);

    const portalPage = await context.newPage();
    await portalPage.goto('/portal/demo-freight/login');
    await expect(portalPage).toHaveURL(/\/portal\/demo-freight\/login$/);
    await expect(portalPage.locator('button[type="submit"]')).toBeEnabled();

    const companyPage = await context.newPage();
    await companyPage.goto('/login');
    await expect(companyPage).toHaveURL(/\/login$/);
    await expect(companyPage.locator('button[type="submit"]')).toBeEnabled();
  });

  test('Portal session does not auto-login on platform or company login pages', async ({ browser }) => {
    const context = await browser.newContext();
    const portalPage = await context.newPage();
    await loginAsClientPortalUser(portalPage, 'demo-freight');

    const platformPage = await context.newPage();
    await platformPage.goto('/platform-login');
    await expect(platformPage).toHaveURL(/\/platform-login$/);
    await expect(platformPage.locator('button[type="submit"]')).toBeEnabled();

    const companyPage = await context.newPage();
    await companyPage.goto('/login');
    await expect(companyPage).toHaveURL(/\/login$/);
    await expect(companyPage.locator('button[type="submit"]')).toBeEnabled();
  });
});
