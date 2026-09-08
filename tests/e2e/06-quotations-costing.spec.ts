import { test, expect } from '@playwright/test';
import {
  createCompanyAdminSession,
  createPortalClientSession,
  loginAsCompanyAdmin,
  waitForHydration,
} from './helpers/auth';
import { generateTestName } from './helpers/test-data';

const internalTerms = [
  'total buy',
  'gross profit',
  'profit margin',
  'buy rate',
  'vendor cost',
  'internal notes',
  'buy amount',
  'profit amount',
];

test.describe('Quotations and Costing', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsCompanyAdmin(page);
  });

  test('Can view quotations list', async ({ page }) => {
    await page.goto('/dashboard/quotations');
    await expect(page.locator('h1')).toContainText('Quotations');
    await expect(page.getByText('Customer offers and sales quotes. Accepted quotations can move forward into shipment job files when conversion is available.')).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Quote / Status' })).toBeVisible();
  });

  test('Can view costing on shipment', async ({ page }) => {
    await page.goto('/dashboard/shipments');
    await page.locator('tr').nth(1).getByRole('link', { name: 'View' }).click();
    await expect(page).toHaveURL(/\/dashboard\/shipments\/[^/]+$/);
    await expect(page.locator('#costing').getByRole('heading', { name: 'Costing' })).toBeVisible();
    await expect(page.locator('#costing').getByText('Total buy', { exact: true })).toBeVisible();
  });

  test('Portal request quotation charges persist after save and reopen', async ({ browser }) => {
    test.setTimeout(90_000);
    const requestRef = generateTestName('CHG');
    const portal = await createPortalClientSession(browser, 'demo-freight');
    const admin = await createCompanyAdminSession(browser);

    try {
      await portal.page.goto('/portal/demo-freight/requests/new');
      await waitForHydration(portal.page);
      await portal.page.selectOption('select[name="shipmentType"]', 'IMPORT');
      await portal.page.selectOption('select[name="transportMode"]', 'SEA');
      await portal.page.selectOption('select[name="serviceScope"]', 'PORT_TO_PORT');
      await portal.page.fill('input[name="originCountry"]', 'China');
      await portal.page.fill('input[name="originPort"]', 'Shanghai');
      await portal.page.fill('input[name="destinationCountry"]', 'Bangladesh');
      await portal.page.fill('input[name="destinationPort"]', 'Chattogram');
      await portal.page.fill('textarea[name="cargoDescription"]', 'Charge persistence cargo');
      await portal.page.fill('input[name="customerReference"]', requestRef);
      await portal.page.getByRole('button', { name: 'Submit shipment request' }).click();
      await expect(portal.page.getByText(/submitted/i)).toBeVisible();

      await portal.page.goto('/portal/demo-freight/requests');
      const requestNo = await portal.page.locator('a.block').first().locator('p.font-medium').innerText();

      await admin.page.goto('/dashboard/shipment-requests');
      const requestRow = admin.page.getByRole('row').filter({ hasText: requestNo });
      await requestRow.getByRole('link', { name: 'View' }).click();
      await expect(admin.page.getByText(requestRef, { exact: true })).toBeVisible();
      await admin.page.getByRole('button', { name: 'Create quotation', exact: true }).click();
      await expect(admin.page.getByText(/Quotation QT-\d{4}-\d+ created\./)).toBeVisible();

      const linkedQuotation = admin.page
        .getByRole('heading', { name: 'Linked quotations' })
        .locator('..')
        .locator('..');
      await linkedQuotation.getByRole('link', { name: 'Open quotation' }).first().click();
      await expect(admin.page).toHaveURL(/\/dashboard\/quotations\/[^/]+$/);
      await expect(admin.page.getByText(/Customer sales quote for/i)).toBeVisible();
      await expect(admin.page.getByText(/Accepted quotations can convert to a shipment job file/i)).toBeVisible();

      await admin.page.fill('input[name="chargeName"]', 'Ocean Freight');
      await admin.page.fill('input[name="sellRate"]', '1200');
      await admin.page.getByRole('button', { name: 'Add charge', exact: true }).click();
      await expect(admin.page.getByText('Charge added.')).toBeVisible();
      await expect(admin.page.getByRole('cell', { name: 'Ocean Freight' })).toBeVisible();
      await expect(admin.page.getByText('BDT 1,200.00').first()).toBeVisible();

      await admin.page.fill('input[name="chargeName"]', 'Documentation Fee');
      await admin.page.fill('input[name="quantity"]', '2');
      await admin.page.fill('input[name="sellRate"]', '150');
      await admin.page.getByRole('button', { name: 'Add charge', exact: true }).click();
      await expect(admin.page.getByText('Charge added.').last()).toBeVisible();
      await expect(admin.page.getByRole('cell', { name: 'Documentation Fee' })).toBeVisible();
      await expect(admin.page.getByText('BDT 300.00').first()).toBeVisible();

      const quotationUrl = admin.page.url();
      await admin.page.goto('/dashboard/quotations');
      await admin.page.goto(quotationUrl);
      await expect(admin.page.getByRole('cell', { name: 'Ocean Freight' })).toBeVisible();
      await expect(admin.page.getByRole('cell', { name: 'Documentation Fee' })).toBeVisible();
      await expect(admin.page.getByText('BDT 1,500.00').first()).toBeVisible();

      await admin.page.getByRole('button', { name: 'SENT', exact: true }).click();
      await expect(admin.page.getByText('SENT', { exact: true }).first()).toBeVisible();

      await portal.page.goto('/portal/demo-freight/requests');
      await portal.page.locator('a.block', { hasText: requestNo }).click();
      await expect(portal.page.getByText('Ocean Freight')).toBeVisible();
      await expect(portal.page.getByText('Documentation Fee')).toBeVisible();
      await expect(portal.page.getByText(/1,?200\.00/).first()).toBeVisible();
      await expect(portal.page.getByText(/300\.00/).first()).toBeVisible();
      await expect(portal.page.getByText(/1,?500\.00/).first()).toBeVisible();

      const portalSource = await portal.page.content();
      for (const term of internalTerms) {
        expect(portalSource.toLowerCase()).not.toContain(term);
      }

      await portal.page.getByRole('link', { name: 'Open quotation' }).click();
      await expect(portal.page.getByText('Ocean Freight')).toBeVisible();
      await expect(portal.page.getByText('Documentation Fee')).toBeVisible();
      const quotationPageText = (await portal.page.locator('body').innerText()).toLowerCase();
      for (const term of internalTerms) {
        expect(quotationPageText).not.toContain(term);
      }
    } finally {
      await Promise.allSettled([portal.context.close(), admin.context.close()]);
    }
  });
});
