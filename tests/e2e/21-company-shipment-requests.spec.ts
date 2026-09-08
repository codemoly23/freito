import { test, expect } from '@playwright/test';
import {
  createCompanyAdminSession,
  createPortalClientSession,
  waitForHydration,
} from './helpers/auth';
import { generateTestName } from './helpers/test-data';

test.describe('Company Dashboard Shipment Requests', () => {
  test('Company Admin can create shipment request on behalf of customer and convert it to quotation', async ({ browser }) => {
    test.setTimeout(90_000);
    const admin = await createCompanyAdminSession(browser);
    const requestRef = generateTestName('CORP_REF');

    try {
      // 1. Navigate to new shipment request page
      await admin.page.goto('/dashboard/shipment-requests/new');
      await waitForHydration(admin.page);

      // 2. Fill the form
      await admin.page.selectOption('select[name="customerId"]', { index: 1 });
      await admin.page.selectOption('select[name="shipmentType"]', 'EXPORT');
      await admin.page.selectOption('select[name="transportMode"]', 'AIR');
      await admin.page.selectOption('select[name="serviceScope"]', 'DOOR_TO_DOOR');
      await admin.page.selectOption('select[name="loadType"]', 'AIR_CARGO');

      await admin.page.fill('input[name="originCountry"]', 'Bangladesh');
      await admin.page.fill('input[name="originPort"]', 'DAC');
      await admin.page.fill('input[name="destinationCountry"]', 'USA');
      await admin.page.fill('input[name="destinationPort"]', 'JFK');

      await admin.page.fill('input[name="pickupAddress"]', 'Dhaka Origin Factory');
      await admin.page.fill('input[name="deliveryAddress"]', 'NY Destination Warehouse');
      
      await admin.page.fill('textarea[name="cargoDescription"]', 'Corporate Air Cargo details');
      await admin.page.fill('input[name="customerReference"]', requestRef);

      // Submit
      await admin.page.click('button[type="submit"]');

      // 3. Verify redirected to shipment request list page and request is visible
      await expect(admin.page).toHaveURL(/\/dashboard\/shipment-requests\/?$/);

      const firstRow = admin.page.locator('tbody tr').first();
      await expect(firstRow).toBeVisible();
      await expect(firstRow.locator('td', { hasText: 'Company Dashboard' })).toBeVisible();

      // Open detail view
      await firstRow.getByRole('link', { name: /view/i }).click();
      await expect(admin.page).toHaveURL(/\/dashboard\/shipment-requests\/[^/]+$/);
      await expect(admin.page.getByText(requestRef, { exact: true })).toBeVisible();

      // Verify Audit Log has the SHIPMENT_REQUEST_CREATED action with the creator actor
      const auditLog = admin.page.locator('main').getByText('SHIPMENT_REQUEST_CREATED');
      await expect(auditLog).toBeVisible();
      await expect(admin.page.locator('main').getByText('Actor: Company Admin')).toBeVisible();

      // 4. Create quotation from the employee-created request
      await admin.page.getByRole('button', { name: 'Create quotation', exact: true }).click();
      await expect(admin.page.getByText(/Quotation QT-\d{4}-\d+ created\./)).toBeVisible();
      await expect(admin.page.getByText('QUOTED', { exact: true }).first()).toBeVisible();

    } finally {
      await admin.context.close();
    }
  });

  test('Portal user cannot access dashboard create route', async ({ browser }) => {
    const portal = await createPortalClientSession(browser, 'demo-freight');
    try {
      await portal.page.goto('/dashboard/shipment-requests/new');
      await expect(portal.page).not.toHaveURL(/\/dashboard\/shipment-requests\/new/);
    } finally {
      await portal.context.close();
    }
  });
});
