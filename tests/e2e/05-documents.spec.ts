import { test, expect } from '@playwright/test';
import { loginAsCompanyAdmin } from './helpers/auth';
import path from 'path';

test.describe('Document Management', () => {
  test('Company Admin can upload, verify and securely download document', async ({ page, browser }) => {
    await loginAsCompanyAdmin(page);
    
    // Go to first shipment
    await page.goto('/dashboard/shipments');
    await page.locator('tr').nth(1).getByRole('link', { name: 'View' }).click();
    await expect(page).toHaveURL(/\/dashboard\/shipments\/[^/]+$/);
    
    const documentRow = page.getByRole('row').filter({ hasText: 'Commercial Invoice' }).first();
    await expect(documentRow).toBeVisible();
    await documentRow.locator('input[type="file"]').setInputFiles(
      path.join(__dirname, 'fixtures', 'sample-document.pdf'),
    );
    await documentRow.getByRole('button', { name: 'Upload' }).click();
    await expect(documentRow.getByText('UPLOADED', { exact: true })).toBeVisible();
    
    // Verify document
    await documentRow.getByRole('button', { name: 'Verify' }).click();
    await expect(documentRow.getByText('VERIFIED', { exact: true })).toBeVisible();

    const downloadLink = documentRow.getByRole('link', { name: /Download/ });
    const downloadHref = await downloadLink.getAttribute('href');
    expect(downloadHref).toBeTruthy();
    const downloadPromise = page.waitForEvent('download');
    await downloadLink.click();
    await downloadPromise;

    const anonymousContext = await browser.newContext();
    try {
      const anonymousResponse = await anonymousContext.request.get(downloadHref!);
      expect(anonymousResponse.status()).toBe(404);
      expect(await anonymousResponse.text()).toBe('Not found');
    } finally {
      await anonymousContext.close();
    }
  });
});
