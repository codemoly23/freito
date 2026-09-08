import 'dotenv/config';
import { test, expect } from '@playwright/test';
import mariadb from 'mariadb';
import { loginAsClientPortalUser, loginAsCompanyAdmin, loginAsCompanyUser, loginAsPlatformOwner } from './helpers/auth';

test.describe('Phase 7 Reports and Analytics', () => {
  test('Company Admin can open dashboard KPIs and every report page', async ({ page }) => {
    await loginAsCompanyAdmin(page);
    await expect(page.getByText('Control Tower').first()).toBeVisible();
    await expect(page.getByRole('link', { name: 'Report Center', exact: true }).first()).toBeVisible();

    const pages = [
      ['/dashboard/reports', 'Reports & Analytics'],
      ['/dashboard/reports/operations', 'Operations Report'],
      ['/dashboard/reports/requests', 'Shipment Request Report'],
      ['/dashboard/reports/quotations', 'Quotation & Sales Report'],
      ['/dashboard/reports/documents', 'Document Report'],
      ['/dashboard/reports/workflow', 'Workflow / Delivery Report'],
      ['/dashboard/reports/financial', 'Financial Report'],
      ['/dashboard/reports/customers', 'Customer Report'],
      ['/dashboard/reports/vendors', 'Vendor Report'],
    ] as const;

    for (const [url, heading] of pages) {
      await page.goto(url);
      await expect(page.getByRole('heading', { name: heading })).toBeVisible();
    }

    await page.goto('/dashboard/reports/operations?status=__INVALID__&from=2020-01-01&to=2030-01-01');
    await expect(page.getByRole('heading', { name: 'Operations Report' })).toBeVisible();
    await expect(page.getByLabel('From date')).toHaveValue(/\d{4}-\d{2}-\d{2}/);
  });

  test('Accounts Officer can access financial reports', async ({ page }) => {
    await loginAsCompanyUser(page, 'accounts@freightcontrol.com');
    await page.goto('/dashboard/reports/financial');
    await expect(page.getByRole('heading', { name: 'Financial Report' })).toBeVisible();
    await expect(page.getByRole('paragraph').filter({ hasText: /^Gross profit$/ })).toBeVisible();
  });

  test('Sales Executive is denied financial and internal workflow reports', async ({ page }) => {
    await loginAsCompanyUser(page, 'sales@freightcontrol.com');
    await page.goto('/dashboard/reports/financial');
    await expect(page).toHaveURL(/\/dashboard\/reports\?access=denied/);
    await expect(page.getByText('Your role does not have access')).toBeVisible();
    await page.goto('/dashboard/reports/workflow');
    await expect(page).toHaveURL(/\/dashboard\/reports\?access=denied/);
    await page.goto('/dashboard/reports/quotations');
    await expect(page.getByRole('heading', { name: 'Quotation & Sales Report' })).toBeVisible();
    await expect(page.getByText('Gross profit', { exact: true })).toHaveCount(0);
  });

  test('Documentation Officer can access document and workflow reports only', async ({ page }) => {
    await loginAsCompanyUser(page, 'documentation@freightcontrol.com');
    await page.goto('/dashboard/reports/documents');
    await expect(page.getByRole('heading', { name: 'Document Report' })).toBeVisible();
    await page.goto('/dashboard/reports/workflow');
    await expect(page.getByRole('heading', { name: 'Workflow / Delivery Report' })).toBeVisible();
    await page.goto('/dashboard/reports/operations');
    await expect(page).toHaveURL(/\/dashboard\/reports\?access=denied/);
  });

  test('Client and platform sessions cannot access company reports', async ({ browser }) => {
    const portalContext = await browser.newContext();
    const portalPage = await portalContext.newPage();
    const platformContext = await browser.newContext();
    const platformPage = await platformContext.newPage();
    try {
      await loginAsClientPortalUser(portalPage, 'demo-freight');
      await portalPage.goto('/dashboard/reports');
      // Client portal sessions must not access company dashboard — expect secure wrong-surface redirect
      await expect(portalPage).toHaveURL(/\/login\?error=wrong-portal/);

      await loginAsPlatformOwner(platformPage);
      await platformPage.goto('/dashboard/reports');
      await expect(platformPage).toHaveURL(/\/login\?error=wrong-portal/);
    } finally {
      await portalContext.close();
      await platformContext.close();
    }
  });

  test('REPORTS module blocks reports and can be safely restored', async ({ page }) => {
    const databaseUrl = new URL(process.env.DATABASE_URL ?? '');
    const connection = await mariadb.createConnection({
      host: databaseUrl.hostname,
      port: databaseUrl.port ? Number(databaseUrl.port) : 3306,
      user: decodeURIComponent(databaseUrl.username),
      password: decodeURIComponent(databaseUrl.password),
      database: databaseUrl.pathname.slice(1),
    });
    await loginAsCompanyAdmin(page);
    try {
      await connection.query(
        'UPDATE CompanyModuleAccess SET isEnabled = 0 WHERE moduleKey = ? AND companyId = (SELECT id FROM Company WHERE portalSlug = ? LIMIT 1)',
        ['REPORTS', 'demo-freight'],
      );
      await page.goto('/dashboard/reports');
      await expect(page).toHaveURL(/\/module-disabled/);
    } finally {
      await connection.query(
        'UPDATE CompanyModuleAccess SET isEnabled = 1 WHERE moduleKey = ? AND companyId = (SELECT id FROM Company WHERE portalSlug = ? LIMIT 1)',
        ['REPORTS', 'demo-freight'],
      );
      await connection.end();
    }
    await page.goto('/dashboard/reports');
    await expect(page.getByRole('heading', { name: 'Reports & Analytics' })).toBeVisible();
  });
});
