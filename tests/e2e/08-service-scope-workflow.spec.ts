import 'dotenv/config';
import { test, expect } from '@playwright/test';
import mariadb from 'mariadb';
import { loginAsCompanyAdmin, waitForHydration } from './helpers/auth';
import { generateTestName } from './helpers/test-data';

async function createDbConnection() {
  const databaseUrl = new URL(process.env.DATABASE_URL ?? '');
  return mariadb.createConnection({
    host: databaseUrl.hostname,
    port: databaseUrl.port ? Number(databaseUrl.port) : 3306,
    user: decodeURIComponent(databaseUrl.username),
    password: decodeURIComponent(databaseUrl.password),
    database: databaseUrl.pathname.slice(1),
  });
}

async function findShipmentByShipperName(shipperName: string) {
  const connection = await createDbConnection();
  try {
    for (let attempt = 0; attempt < 30; attempt += 1) {
      const [shipment] = await connection.query<{ id: string; jobNo: string }[]>(
        `SELECT id, jobNo
         FROM ShipmentJob
         WHERE shipperName = ? AND deletedAt IS NULL
         ORDER BY createdAt DESC
         LIMIT 1`,
        [shipperName],
      );
      if (shipment) return { shipmentId: shipment.id, jobNo: shipment.jobNo };
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
  } finally {
    await connection.end();
  }

  throw new Error(`Shipment was not created for ${shipperName}`);
}

test.describe('Service Scope and Workflow', () => {
  test('PORT_TO_PORT shipment has 7 workflow steps', async ({ page }) => {
    await loginAsCompanyAdmin(page);
    await page.goto('/dashboard/shipments/new');
    await waitForHydration(page);
    
    const jobRef = generateTestName('P2P');
    await page.fill('input[name="shipperName"]', jobRef);
    await page.selectOption('select[name="shipmentType"]', 'IMPORT');
    await page.selectOption('select[name="transportMode"]', 'SEA');
    await page.selectOption('select[name="serviceScope"]', 'PORT_TO_PORT');
    
    // Fill required fields
    await page.selectOption('select[name="customerId"]', { index: 1 });
    await page.fill('input[name="originCountry"]', 'China');
    await page.fill('input[name="originPort"]', 'Shanghai');
    await page.fill('input[name="destinationCountry"]', 'Bangladesh');
    await page.fill('input[name="destinationPort"]', 'Chattogram');
    await page.fill('textarea[name="cargoDescription"]', 'QA port-to-port cargo');
    await page.selectOption('select[name="assignedToId"]', { index: 1 });
    
    await page.getByRole('button', { name: 'Create shipment' }).click();
    const created = await findShipmentByShipperName(jobRef);
    
    // Verify steps count
    await page.goto(`/dashboard/shipments/${created.shipmentId}`);
    await waitForHydration(page);
    const workflow = page.locator('#operations-workflow');
    await expect(workflow.getByRole('button', { name: 'Delete', exact: true })).toHaveCount(7);

    await workflow.locator('select[name="status"]').first().selectOption('IN_PROGRESS');
    await workflow.locator('input[name="notes"]').first().fill('QA workflow started');
    await workflow.getByRole('button', { name: 'Save', exact: true }).first().click();
    await expect(workflow.getByText('IN PROGRESS', { exact: true }).first()).toBeVisible();

    await workflow.locator('select[name="handlerType"]').first().selectOption('INTERNAL_EMPLOYEE');
    await workflow.locator('select[name="assignedUserId"]').first().selectOption({
      label: 'Company Admin (admin@freightcontrol.com)',
    });
    await workflow.getByRole('button', { name: 'Assign', exact: true }).first().click();
    await expect(workflow.getByText('Handler: INTERNAL EMPLOYEE', { exact: true }).first()).toBeVisible();
    await expect(workflow.getByText('Assigned: Company Admin', { exact: true }).first()).toBeVisible();
  });

  test('DOOR_TO_DOOR shipment has 18 workflow steps', async ({ page }) => {
    await loginAsCompanyAdmin(page);
    await page.goto('/dashboard/shipments/new');
    await waitForHydration(page);
    
    const jobRef = generateTestName('D2D');
    await page.fill('input[name="shipperName"]', jobRef);
    await page.selectOption('select[name="shipmentType"]', 'IMPORT');
    await page.selectOption('select[name="transportMode"]', 'SEA');
    await page.selectOption('select[name="serviceScope"]', 'DOOR_TO_DOOR');
    
    // Fill required fields
    await page.selectOption('select[name="customerId"]', { index: 1 });
    await page.fill('input[name="originCountry"]', 'China');
    await page.fill('input[name="originPort"]', 'Shanghai');
    await page.fill('input[name="destinationCountry"]', 'Bangladesh');
    await page.fill('input[name="destinationPort"]', 'Chattogram');
    await page.fill('textarea[name="pickupAddress"]', 'Factory A');
    await page.fill('textarea[name="deliveryAddress"]', 'Warehouse B');
    await page.fill('textarea[name="cargoDescription"]', 'QA door-to-door cargo');
    await page.selectOption('select[name="assignedToId"]', { index: 1 });
    
    await page.getByRole('button', { name: 'Create shipment' }).click();
    const created = await findShipmentByShipperName(jobRef);
    
    // Verify steps count
    await page.goto(`/dashboard/shipments/${created.shipmentId}`);
    await waitForHydration(page);
    await expect(page.locator('#operations-workflow').getByRole('button', { name: 'Delete', exact: true })).toHaveCount(18);
  });
});
