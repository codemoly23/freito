import { test, expect } from '@playwright/test';
import { loginAsCompanyAdmin } from './helpers/auth';
import { generateTestName } from './helpers/test-data';

test.describe('Billing and Payments', () => {
  const invoiceRef = generateTestName('INV');

  test('Company Admin can create invoice and record payment', async ({ page }) => {
    await loginAsCompanyAdmin(page);
    await page.goto('/dashboard/invoices/new');
    
    // Wait for form to load
    await page.waitForSelector('form', { timeout: 10000 });
    await page.waitForSelector('select[name="customerId"]', { timeout: 10000 });
    
    // Fill header fields
    await page.selectOption('select[name="customerId"]', { index: 1 });
    const invoiceDate = new Date().toISOString().split('T')[0];
    await page.fill('input[name="invoiceDate"]', invoiceDate);
    await page.fill('textarea[name="remarks"]', invoiceRef);
    
    // Fill line item using generic name-based selector (formData.getAll() uses name attribute)
    // All line items use names: lineDescription, lineQuantity, lineUnitPrice (without index)
    await page.waitForSelector('input[name="lineDescription"]', { timeout: 10000 });
    await page.fill('input[name="lineDescription"]', 'Freight Charges');
    await page.fill('input[name="lineQuantity"]', '1');
    await page.fill('input[name="lineUnitPrice"]', '1500');
    
    // Submit form
    const createBtn = page.getByRole('button', { name: 'Create invoice' });
    await createBtn.waitFor({ state: 'visible', timeout: 10000 });
    await createBtn.click();
    
    // Wait for success alert message
    const alert = page.getByText(/Invoice INV-\d{4}-\d+ created\./);
    await expect(alert).toBeVisible({ timeout: 10000 });
    const alertText = await alert.innerText();
    const invoiceMatch = alertText.match(/INV-\d{4}-\d+/);
    if (!invoiceMatch) {
      throw new Error(`Failed to extract invoice number from alert text: "${alertText}"`);
    }
    const invoiceNo = invoiceMatch[0];
    
    // Navigate to invoices list to find the newly created invoice by number
    await page.goto('/dashboard/invoices');
    await page.waitForSelector('table', { timeout: 10000 });
    
    // Find invoice row by invoice number
    const invoiceRow = page.getByRole('row').filter({ has: page.getByText(invoiceNo) });
    await expect(invoiceRow).toBeVisible({ timeout: 10000 });
    
    // Record Payment
    await page.goto('/dashboard/payments/received/new');
    await page.waitForSelector('form', { timeout: 10000 });
    await page.selectOption('select[name="customerId"]', { index: 1 });
    
    // Wait for invoice dropdown to populate
    await page.waitForSelector('select[name="invoiceId"] option:nth-of-type(2)', { state: 'attached', timeout: 10000 });
    
    // Find invoice by number in the dropdown
    const invoiceOption = page.locator(`select[name="invoiceId"] option:has-text("${invoiceNo}")`).first();
    const invoiceValue = await invoiceOption.getAttribute('value');
    expect(invoiceValue).toBeTruthy();
    
    await page.selectOption('select[name="invoiceId"]', invoiceValue!);
    await page.fill('input[name="amount"]', '1500');
    await page.selectOption('select[name="paymentMethod"]', 'BANK_TRANSFER');
    
    const recordBtn = page.getByRole('button', { name: 'Record receipt' });
    await recordBtn.click();
    
    // Wait for page navigation after payment submission
    await page.waitForURL(/\/dashboard\/payments/, { timeout: 10000 });
    await page.waitForLoadState('networkidle');
    
    // Verify payment was recorded by navigating back to invoices
    await page.goto('/dashboard/invoices');
    await page.waitForSelector('table', { timeout: 10000 });
    const paidInvoiceRow = page.getByRole('row').filter({ hasText: invoiceNo });
    await expect(paidInvoiceRow.getByText('PAID')).toBeVisible({ timeout: 10000 });
  });

  test('Company Admin can create vendor bill, pay it, and open aging pages', async ({ page }) => {
    await loginAsCompanyAdmin(page);
    await page.goto('/dashboard/vendor-bills/new');
    await page.selectOption('select[name="vendorId"]', { index: 1 });
    await page.fill('input[name="lineDescription"]', 'QA vendor freight');
    await page.fill('input[name="lineQuantity"]', '1');
    await page.fill('input[name="lineUnitPrice"]', '500');
    await page.getByRole('button', { name: 'Create vendor bill' }).click();

    const billCreated = page.getByText(/Vendor bill VB-\d{4}-\d+ created\./);
    await expect(billCreated).toBeVisible();
    const billNo = (await billCreated.innerText()).match(/VB-\d{4}-\d+/)?.[0];
    expect(billNo).toBeTruthy();

    await page.goto('/dashboard/payments/paid/new');
    await page.selectOption('select[name="vendorId"]', { index: 1 });
    const billOption = page.locator('select[name="vendorBillId"] option').filter({ hasText: billNo! });
    await page.selectOption(
      'select[name="vendorBillId"]',
      (await billOption.getAttribute('value'))!,
    );
    await page.fill('input[name="amount"]', '500');
    await page.getByRole('button', { name: 'Record payment' }).click();
    await expect(page.getByText(/Payment PAY-\d{4}-\d+ recorded\./)).toBeVisible();

    await page.goto('/dashboard/receivables');
    await expect(page.getByRole('heading', { name: 'Receivables' })).toBeVisible();
    await page.goto('/dashboard/payables');
    await expect(page.getByRole('heading', { name: 'Payables' })).toBeVisible();
  });
});
