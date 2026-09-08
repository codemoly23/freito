import { test, expect } from '@playwright/test';
import { loginAsCompanyAdmin, waitForHydration } from './helpers/auth';

test.describe('Shipment Management', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsCompanyAdmin(page);
  });

  test('Can view shipment list', async ({ page }) => {
    await page.goto('/dashboard/shipments');
    await expect(page.locator('h1').first()).toContainText('Shipments');
  });

  test('Can view shipment details', async ({ page }) => {
    await page.goto('/dashboard/shipments');
    const firstRow = page.locator('tr').nth(1);
    await expect(firstRow).toBeVisible();
    await firstRow.getByRole('link', { name: 'View' }).click();
    await expect(page).toHaveURL(/\/dashboard\/shipments\/[^/]+$/);
    await waitForHydration(page);
    await expect(page.getByRole('tab', { name: 'Overview' })).toHaveAttribute('aria-selected', 'true');
    await expect(page.getByRole('heading', { name: 'Status Timeline' })).not.toBeVisible();
    await page.getByRole('tab', { name: 'Timeline' }).click();
    await expect(page.getByRole('heading', { name: 'Status Timeline' })).toBeVisible();
    const editHref = await page.getByRole('link', { name: 'Edit', exact: true }).getAttribute('href');
    expect(editHref).toBeTruthy();
    await page.goto(editHref!);
    await expect(page).toHaveURL(/\/dashboard\/shipments\/[^/]+\/edit$/);
    await expect(page.getByRole('heading', { name: 'Edit Shipment' })).toBeVisible();
  });

  test('Shipment detail sections behave as true tabs', async ({ page }) => {
    await page.goto('/dashboard/shipments');
    const firstRow = page.locator('tr').nth(1);
    await expect(firstRow).toBeVisible();
    await firstRow.getByRole('link', { name: 'View' }).click();
    await expect(page).toHaveURL(/\/dashboard\/shipments\/[^/]+$/);
    await waitForHydration(page);

    await expect(page.getByRole('tab', { name: 'Overview' })).toHaveAttribute('aria-selected', 'true');
    await expect(page.locator('#overview')).toBeVisible();
    await expect(page.locator('#workflow')).not.toBeVisible();

    await page.getByRole('tab', { name: 'Workflow' }).click();
    await expect(page.locator('#workflow')).toBeVisible();
    await expect(page.locator('#overview')).not.toBeVisible();

    await page.getByRole('tab', { name: 'Documents', exact: true }).click();
    await expect(page.locator('#documents')).toBeVisible();

    await page.getByRole('tab', { name: 'Freight Documents' }).click();
    await expect(page.locator('#freight-documents')).toBeVisible();
    await expect(page.getByRole('heading', { name: /Generated Freight Documents/i })).toBeVisible();

    await page.getByRole('tab', { name: 'Finance' }).click();
    await expect(page.locator('#finance')).toBeVisible();

    await page.getByRole('tab', { name: 'Tasks' }).click();
    await expect(page.locator('#tasks')).toBeVisible();

    await page.getByRole('tab', { name: 'Audit' }).click();
    await expect(page.locator('#audit')).toBeVisible();
  });
});
