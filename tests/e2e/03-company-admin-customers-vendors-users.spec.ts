import { test, expect } from '@playwright/test';
import { loginAsCompanyAdmin } from './helpers/auth';
import { generateTestName, generateTestEmail } from './helpers/test-data';

test.describe('Company Data Management', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsCompanyAdmin(page);
  });

  test('Can create a customer', async ({ page }) => {
    const name = generateTestName('Customer');
    await page.goto('/dashboard/customers');
    await page.fill('input[name="name"]', name);
    await page.fill('input[name="email"]', generateTestEmail('customer'));
    await page.getByRole('button', { name: 'Create customer' }).click();
    const customerRow = page.getByRole('row', { name: new RegExp(name) });
    await expect(customerRow).toBeVisible();
    await customerRow.getByRole('link', { name: 'Edit' }).click();
    await expect(page.getByRole('heading', { name: 'Edit Customer' })).toBeVisible();
    await expect(page.locator('input[name="name"]')).toHaveValue(name);
  });

  test('Can create a vendor', async ({ page }) => {
    const name = generateTestName('Vendor');
    await page.goto('/dashboard/vendors');
    await page.fill('input[name="name"]', name);
    await page.fill('input[name="email"]', generateTestEmail('vendor'));
    await page.getByRole('button', { name: 'Create vendor' }).click();
    const vendorRow = page.getByRole('row', { name: new RegExp(name) });
    await expect(vendorRow).toBeVisible();
    await vendorRow.getByRole('link', { name: 'Edit' }).click();
    await expect(page.getByRole('heading', { name: 'Edit Vendor' })).toBeVisible();
    await expect(page.locator('input[name="name"]')).toHaveValue(name);
  });

  test('Can view users and roles', async ({ page }) => {
    await page.goto('/dashboard/users');
    await expect(page.locator('h1')).toContainText('Users');
    await page.goto('/dashboard/roles');
    await expect(page.locator('h1')).toContainText('Roles');
  });
});
