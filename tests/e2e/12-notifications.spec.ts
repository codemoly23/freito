import { test, expect } from '@playwright/test';
import {
  createCompanyAdminSession,
  createPlatformSession,
  createPortalClientSession,
  loginAsCompanyAdmin,
} from './helpers/auth';
import { generateTestName } from './helpers/test-data';

test.describe('Phase 8A In-App Notifications', () => {
  test('Portal request and quotation create scoped notifications that can be marked read', async ({ browser }) => {
    const portal = await createPortalClientSession(browser, 'demo-freight');
    const admin = await createCompanyAdminSession(browser);
    const requestRef = generateTestName('NOTIFY');

    try {
      await portal.page.goto('/portal/demo-freight/requests/new');
      await portal.page.selectOption('select[name="shipmentType"]', 'IMPORT');
      await portal.page.selectOption('select[name="transportMode"]', 'SEA');
      await portal.page.selectOption('select[name="serviceScope"]', 'PORT_TO_PORT');
      await portal.page.fill('input[name="originCountry"]', 'China');
      await portal.page.fill('input[name="originPort"]', 'Shanghai');
      await portal.page.fill('input[name="destinationCountry"]', 'Bangladesh');
      await portal.page.fill('input[name="destinationPort"]', 'Chattogram');
      await portal.page.fill('textarea[name="cargoDescription"]', 'Notification QA cargo');
      await portal.page.fill('input[name="customerReference"]', requestRef);
      await portal.page.getByRole('button', { name: 'Submit shipment request' }).click();
      await expect(portal.page.getByText(/submitted/i)).toBeVisible();

      await portal.page.goto('/portal/demo-freight/requests');
      const requestNo = await portal.page.locator('a.block').first().locator('p.font-medium').innerText();

      await admin.page.goto('/dashboard/notifications');
      await expect(admin.page.getByRole('heading', { name: 'Notifications' })).toBeVisible();
      const internalCard = admin.page.locator('[class*="rounded-lg"]').filter({ hasText: requestNo }).filter({ hasText: 'New Shipment Request' }).first();
      await expect(internalCard).toBeVisible();
      await internalCard.getByRole('button', { name: 'Mark read' }).click();
      await expect(internalCard.getByText('Read', { exact: true })).toBeVisible();

      await admin.page.goto('/dashboard/shipment-requests');
      const requestRow = admin.page.getByRole('row').filter({ hasText: requestNo });
      await requestRow.getByRole('link', { name: 'View' }).click();
      await expect(admin.page.getByText(requestRef, { exact: true })).toBeVisible();
      await admin.page.getByRole('button', { name: 'Create quotation', exact: true }).click();
      await expect(admin.page.getByText(/Quotation QT-\d{4}-\d+ created\./)).toBeVisible();

      await portal.page.goto('/portal/demo-freight/notifications');
      await expect(portal.page.getByRole('heading', { name: 'Notifications' })).toBeVisible();
      const portalCard = portal.page.locator('[class*="rounded-lg"]').filter({ hasText: requestNo }).filter({ hasText: 'New Quotation Available' }).first();
      await expect(portalCard).toBeVisible();
      const portalSource = await portal.page.content();
      for (const internalText of ['Buy Cost', 'Internal Cost', 'Gross Profit', 'Margin', 'Vendor Cost', 'Assigned Employee', 'Handler Type']) {
        expect(portalSource).not.toContain(internalText);
      }
      await portalCard.getByRole('button', { name: 'Mark read' }).click();
      await expect(portalCard.getByText('Read', { exact: true })).toBeVisible();
    } finally {
      await Promise.allSettled([portal.context.close(), admin.context.close()]);
    }
  });

  test('Company notification page and bell are available to authorized company users', async ({ page }) => {
    await loginAsCompanyAdmin(page);
    await expect(page.getByRole('link', { name: /Notifications/ })).toBeVisible();
    await page.goto('/dashboard/notifications?filter=unread');
    await expect(page.getByRole('heading', { name: 'Notifications' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Unread', exact: true })).toBeVisible();
  });

  test('Portal, company, and platform sessions cannot cross notification scopes', async ({ browser }) => {
    const portal = await createPortalClientSession(browser, 'demo-freight');
    const admin = await createCompanyAdminSession(browser);
    const platform = await createPlatformSession(browser);
    try {
      await portal.page.goto('/dashboard/notifications');
      await expect(portal.page).not.toHaveURL(/\/dashboard\/notifications/);

      await admin.page.goto('/portal/demo-freight/notifications');
      await expect(admin.page).not.toHaveURL(/\/portal\/demo-freight\/notifications/);

      await platform.page.goto('/dashboard/notifications');
      await expect(platform.page).not.toHaveURL(/\/dashboard\/notifications/);
    } finally {
      await Promise.allSettled([portal.context.close(), admin.context.close(), platform.context.close()]);
    }
  });
});
