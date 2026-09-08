import 'dotenv/config';
import { test, expect, Page } from '@playwright/test';
import mariadb from 'mariadb';
import {
  createCompanyAdminSession,
  createPortalClientSession,
  waitForHydration,
} from './helpers/auth';
import { generateTestName } from './helpers/test-data';

async function getRequestNoByReference(requestRef: string) {
  const url = new URL(process.env.DATABASE_URL!);
  const connection = await mariadb.createConnection({
    host: url.hostname,
    port: url.port ? Number(url.port) : 3306,
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    database: url.pathname.replace(/^\//, ''),
  });

  try {
    for (let attempt = 0; attempt < 20; attempt += 1) {
      const rows = await connection.query(
        'SELECT requestNo FROM ShipmentRequest WHERE customerReference = ? ORDER BY createdAt DESC LIMIT 1',
        [requestRef],
      ) as Array<{ requestNo: string }>;
      if (rows[0]?.requestNo) return rows[0].requestNo;
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
  } finally {
    await connection.end();
  }

  throw new Error(`Shipment request not found for reference ${requestRef}`);
}

async function createSentPortalQuotation(
  portalPage: Page,
  adminPage: Page,
  requestRef: string,
) {
  await portalPage.goto('/portal/demo-freight/requests/new');
  await portalPage.selectOption('select[name="shipmentType"]', 'IMPORT');
  await portalPage.selectOption('select[name="transportMode"]', 'SEA');
  await portalPage.selectOption('select[name="serviceScope"]', 'PORT_TO_PORT');
  await portalPage.fill('input[name="originCountry"]', 'China');
  await portalPage.fill('input[name="originPort"]', 'Shanghai');
  await portalPage.fill('input[name="destinationCountry"]', 'Bangladesh');
  await portalPage.fill('input[name="destinationPort"]', 'Chattogram');
  await portalPage.fill('textarea[name="cargoDescription"]', 'QA proposal response cargo');
  await portalPage.fill('input[name="customerReference"]', requestRef);
  await portalPage.getByRole('button', { name: 'Submit shipment request' }).click();
  await expect(portalPage.getByText(/submitted/i)).toBeVisible();
  const requestNo = await getRequestNoByReference(requestRef);

  await adminPage.goto('/dashboard/shipment-requests');
  const requestRow = adminPage.getByRole('row').filter({ hasText: requestNo });
  await requestRow.getByRole('link', { name: 'View' }).click();
  await expect(adminPage.getByText(requestRef, { exact: true })).toBeVisible();
  await adminPage.getByRole('button', { name: 'Create quotation', exact: true }).click();

  const linkedQuotation = adminPage
    .getByRole('heading', { name: 'Linked quotations' })
    .locator('..')
    .locator('..');
  await linkedQuotation.getByRole('link', { name: 'Open quotation' }).first().click();
  await adminPage.fill('input[name="chargeName"]', 'QA Customer Freight');
  await adminPage.fill('input[name="sellRate"]', '750');
  await adminPage.getByRole('button', { name: 'Add charge', exact: true }).click();
  await adminPage.getByRole('button', { name: 'SENT', exact: true }).click();
  await expect(adminPage.getByText('SENT', { exact: true }).first()).toBeVisible();

  return requestNo;
}

test.describe('Client Portal Requests and Conversion', () => {
  test('Full Flow: Request -> Quotation -> Accept -> Convert', async ({ browser }) => {
    test.setTimeout(90_000);
    const requestRef = generateTestName('REF');
    const portal = await createPortalClientSession(browser, 'demo-freight');
    const admin = await createCompanyAdminSession(browser);

    try {
      // 1. Client creates request
      await portal.page.goto('/portal/demo-freight/requests/new');
      await waitForHydration(portal.page);
    
      await portal.page.selectOption('select[name="shipmentType"]', 'IMPORT');
      await portal.page.selectOption('select[name="transportMode"]', 'SEA');
      await portal.page.selectOption('select[name="serviceScope"]', 'PORT_TO_PORT');
    
      await portal.page.fill('input[name="originCountry"]', 'China');
      await portal.page.fill('input[name="originPort"]', 'Shanghai');
      await portal.page.fill('input[name="destinationCountry"]', 'Bangladesh');
      await portal.page.fill('input[name="destinationPort"]', 'Chattogram');
    
      await portal.page.fill('textarea[name="cargoDescription"]', 'Test Cargo');
      await portal.page.fill('input[name="customerReference"]', requestRef);
    
      await portal.page.click('button[type="submit"]');
      await expect(portal.page.locator('text=submitted')).toBeVisible();

      const requestNo = await getRequestNoByReference(requestRef);

      // 2. Company Admin creates quotation
      await admin.page.goto('/dashboard/shipment-requests');
      const requestRow = admin.page.locator('tr', { hasText: requestNo });
      await expect(requestRow).toBeVisible();
      const requestHref = await requestRow.getByRole('link', { name: /view/i }).getAttribute('href');
      expect(requestHref).toBeTruthy();
      await admin.page.goto(requestHref!);
      await waitForHydration(admin.page);
      await expect(admin.page).toHaveURL(/\/dashboard\/shipment-requests\/[^/]+$/);
      await expect(admin.page.getByText(requestRef, { exact: true })).toBeVisible();
    
      await admin.page.getByRole('button', { name: 'Create quotation', exact: true }).click();
      await expect(admin.page).toHaveURL(/\/dashboard\/shipment-requests\/[^/]+$/);
      await expect(admin.page.getByText(/Quotation QT-\d{4}-\d+ created\./)).toBeVisible();
      await expect(admin.page.getByText('QUOTED', { exact: true }).first()).toBeVisible();

      const linkedQuotation = admin.page
        .getByRole('heading', { name: 'Linked quotations' })
        .locator('..')
        .locator('..');
      await expect(linkedQuotation.getByText(/QT-\d{4}-\d+/).first()).toBeVisible();
      await linkedQuotation.getByRole('link', { name: 'Open quotation' }).first().click();
      await expect(admin.page).toHaveURL(/\/dashboard\/quotations\/[^/]+$/);

      await admin.page.fill('input[name="chargeName"]', 'Ocean Freight');
      await admin.page.fill('input[name="sellRate"]', '1000');
      await admin.page.getByRole('button', { name: 'Add charge', exact: true }).click();
      await expect(admin.page.getByText('Charge added.')).toBeVisible();
    
      await admin.page.getByRole('button', { name: 'SENT', exact: true }).click();
      await expect(admin.page.getByText('SENT', { exact: true }).first()).toBeVisible();

      // 3. Client Accepts
      await portal.page.goto('/portal/demo-freight/requests');
      await waitForHydration(portal.page);
      await portal.page.locator('a.block', { hasText: requestNo }).click();
      const portalSource = await portal.page.content();
      for (const internalField of [
        'totalBuyAmount',
        'grossProfit',
        'profitMarginPercent',
        'buyRate',
        'profitAmount',
        'vendorId',
        'handlerType',
        'assignedUserId',
      ]) {
        expect(portalSource).not.toContain(internalField);
      }
    
      await portal.page.click('button:has-text("Accept")');
      await expect(portal.page.getByText('ACCEPTED', { exact: true }).first()).toBeVisible();
      await expect(portal.page.getByText(/Customer proposal .* ACCEPTED/)).toBeVisible();
    
      // 4. Company Converts
      await admin.page.goto('/dashboard/shipment-requests');
      const acceptedRequestRow = admin.page.locator('tr', { hasText: requestNo });
      await expect(acceptedRequestRow).toBeVisible();
      const acceptedRequestHref = await acceptedRequestRow.getByRole('link', { name: /view/i }).getAttribute('href');
      expect(acceptedRequestHref).toBeTruthy();
      await admin.page.goto(acceptedRequestHref!);
      await waitForHydration(admin.page);
      await expect(admin.page).toHaveURL(/\/dashboard\/shipment-requests\/[^/]+$/);
      await expect(admin.page.getByText(requestRef, { exact: true })).toBeVisible();
    
      await admin.page.getByRole('button', { name: 'Convert to shipment', exact: true }).click();
      await expect(admin.page.getByText('CONVERTED', { exact: true }).first()).toBeVisible();
      await expect(admin.page.getByRole('button', { name: 'Convert to shipment' })).toHaveCount(0);

      const shipmentLink = admin.page.getByRole('link', { name: /Open shipment/ });
      await expect(shipmentLink).toBeVisible();
      const shipmentHref = await shipmentLink.getAttribute('href');
      expect(shipmentHref).toBeTruthy();
      await admin.page.goto(shipmentHref!);
      await waitForHydration(admin.page);
      await expect(admin.page).toHaveURL(/\/dashboard\/shipments\/[^/]+$/);
      const overviewCard = admin.page.locator('#overview');
      await expect(overviewCard.getByText('Service scope')).toBeVisible();
      await expect(overviewCard.getByText('Port to Port', { exact: true })).toBeVisible();
      const workflowCard = admin.page.locator('#operations-workflow');
      await expect(workflowCard.getByRole('button', { name: 'Delete', exact: true })).toHaveCount(7);
      await expect(admin.page.locator('#costing').getByText(/No costing items added yet/i)).toBeVisible();
      await expect(admin.page.locator('#billing').getByText('BDT 0.00')).toHaveCount(6);
    } finally {
      await Promise.allSettled([
        portal.context.close(),
        admin.context.close(),
      ]);
    }
  });

  test('DOOR_TO_DOOR request requires and stores pickup and delivery addresses', async ({ browser }) => {
    const portal = await createPortalClientSession(browser, 'demo-freight');
    try {
      await portal.page.goto('/portal/demo-freight/requests/new');
      await waitForHydration(portal.page);
      await portal.page.selectOption('select[name="serviceScope"]', 'DOOR_TO_DOOR');
      await portal.page.fill('input[name="originCountry"]', 'China');
      await portal.page.fill('input[name="destinationCountry"]', 'Bangladesh');
      await portal.page.fill('textarea[name="cargoDescription"]', 'QA door validation cargo');
      await expect(portal.page.locator('input[name="pickupAddress"]')).toHaveAttribute('required', '');
      await expect(portal.page.locator('input[name="deliveryAddress"]')).toHaveAttribute('required', '');

      await portal.page.fill('input[name="pickupAddress"]', 'QA Origin Factory');
      await portal.page.fill('input[name="deliveryAddress"]', 'QA Destination Warehouse');
      await portal.page.getByRole('button', { name: 'Submit shipment request' }).click();
      await expect(portal.page.getByText(/submitted/i)).toBeVisible();
    } finally {
      await Promise.allSettled([portal.context.close()]);
    }
  });

  test('Revision request and rejection make quotations non-actionable', async ({ browser }) => {
    const portal = await createPortalClientSession(browser, 'demo-freight');
    const admin = await createCompanyAdminSession(browser);
    try {
      const revisionRequestNo = await createSentPortalQuotation(
        portal.page,
        admin.page,
        generateTestName('REVISION'),
      );
      await portal.page.goto('/portal/demo-freight/requests');
      await portal.page.locator('a.block', { hasText: revisionRequestNo }).click();
      await portal.page.fill('textarea[name="message"]', 'Please revise transit time');
      await portal.page.getByRole('button', { name: 'Request revision' }).click();
      await expect(portal.page.getByText('REVISION REQUESTED', { exact: true })).toBeVisible();
      await expect(portal.page.getByRole('button', { name: 'Accept' })).toHaveCount(0);

      const rejectedRequestNo = await createSentPortalQuotation(
        portal.page,
        admin.page,
        generateTestName('REJECT'),
      );
      await portal.page.goto('/portal/demo-freight/requests');
      await portal.page.locator('a.block', { hasText: rejectedRequestNo }).click();
      await portal.page.fill('textarea[name="message"]', 'Price exceeds budget');
      await portal.page.getByRole('button', { name: 'Reject' }).click();
      await expect(portal.page.getByText('REJECTED', { exact: true }).first()).toBeVisible();
      await expect(portal.page.getByRole('button', { name: 'Accept' })).toHaveCount(0);
    } finally {
      await Promise.allSettled([
        portal.context.close(),
        admin.context.close(),
      ]);
    }
  });
});
