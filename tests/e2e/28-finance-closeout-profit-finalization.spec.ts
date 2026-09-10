import "dotenv/config";
import { expect, test } from "@playwright/test";
import mariadb from "mariadb";
import { randomUUID } from "node:crypto";
import {
  createPortalClientSession,
  loginAsCompanyAdmin,
  waitForHydration,
} from "./helpers/auth";
import { generateTestName } from "./helpers/test-data";

async function createDbConnection() {
  const databaseUrl = new URL(process.env.DATABASE_URL ?? "");
  return mariadb.createConnection({
    host: databaseUrl.hostname,
    port: databaseUrl.port ? Number(databaseUrl.port) : 3306,
    user: decodeURIComponent(databaseUrl.username),
    password: decodeURIComponent(databaseUrl.password),
    database: databaseUrl.pathname.slice(1),
  });
}

async function createShipmentAndOpen(
  page: import("@playwright/test").Page,
  prefix: string,
) {
  await page.goto("/dashboard/shipments/new");
  await waitForHydration(page);

  const jobRef = generateTestName(prefix);
  await page.fill('input[name="shipperName"]', jobRef);
  await page.selectOption('select[name="shipmentType"]', "IMPORT");
  await page.selectOption('select[name="transportMode"]', "SEA");
  await page.selectOption('select[name="loadType"]', "FCL");
  await page.selectOption('select[name="serviceScope"]', "PORT_TO_PORT");
  await page.selectOption('select[name="customerId"]', { index: 1 });
  await page.fill('input[name="originCountry"]', "China");
  await page.fill('input[name="originPort"]', "Shanghai");
  await page.fill('input[name="destinationCountry"]', "Bangladesh");
  await page.fill('input[name="destinationPort"]', "Chattogram");
  await page.fill('textarea[name="cargoDescription"]', "Phase 15 finance closeout cargo");
  await page.selectOption('select[name="assignedToId"]', { index: 1 });

  await page.getByRole("button", { name: "Create shipment" }).click();
  const created = await findShipmentByShipperName(jobRef);
  await page.goto(`/dashboard/shipments/${created.shipmentId}`);
  await waitForHydration(page);

  return {
    jobNo: created.jobNo,
    shipmentId: created.shipmentId,
  };
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
      if (shipment) {
        return { shipmentId: shipment.id, jobNo: shipment.jobNo };
      }
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
  } finally {
    await connection.end();
  }

  throw new Error(`Shipment was not created for ${shipperName}`);
}

async function prepareFinanceData(shipmentId: string) {
  const connection = await createDbConnection();
  const stableTimestamp = new Date("2024-01-02T00:00:00.000Z");

  try {
    const [scope] = await connection.query<{
      companyId: string;
      customerId: string;
      accountId: string;
      userId: string;
      branchId: string;
    }[]>(
      `SELECT c.id AS companyId, cpa.customerId AS customerId, cpa.id AS accountId, u.id AS userId, b.id AS branchId
       FROM Company c
       JOIN ClientPortalAccount cpa ON cpa.companyId = c.id
       JOIN User u ON u.companyId = c.id
       JOIN Branch b ON b.companyId = c.id AND b.isActive = 1
       WHERE c.portalSlug = ? AND cpa.deletedAt IS NULL AND cpa.displayClientCode = ? AND u.email = ?
       LIMIT 1`,
      ["demo-freight", "DFC-CL-2026-0001", "admin@freightcontrol.com"],
    );
    expect(scope).toBeTruthy();

    const invoiceId = `inv_${randomUUID().replace(/-/g, "")}`;
    const invoiceLineId = `invl_${randomUUID().replace(/-/g, "")}`;
    const invoiceNo = `INV-P15-${randomUUID().slice(0, 8).toUpperCase()}`;
    const requestId = `req_${randomUUID().replace(/-/g, "")}`;
    const requestNo = `REQ-P15-${randomUUID().slice(0, 8).toUpperCase()}`;

    await connection.query(
      `UPDATE Customer
       SET deletedAt = NULL, updatedAt = ?
       WHERE id = ? AND companyId = ?`,
      [stableTimestamp, scope.customerId, scope.companyId],
    );
    await connection.query(
      `UPDATE ShipmentJob
       SET customerId = ?, operationsStatus = 'CLOSE_READY', updatedAt = ?
       WHERE id = ? AND companyId = ?`,
      [scope.customerId, stableTimestamp, shipmentId, scope.companyId],
    );
    await connection.query(
      `INSERT INTO Invoice (
        id, companyId, branchId, invoiceNo, customerId, shipmentJobId, status,
        invoiceDate, currency, exchangeRateToBDT, subtotal, discountAmount,
        taxAmount, totalAmount, paidAmount, dueAmount, remarks, createdById,
        createdAt, updatedAt
      ) VALUES (?, ?, ?, ?, ?, ?, 'SENT', ?, 'BDT', 1, 1500, 0, 0, 1500, 0, 1500,
        'Phase 15 finance closeout invoice', ?, ?, ?)`,
      [
        invoiceId,
        scope.companyId,
        scope.branchId,
        invoiceNo,
        scope.customerId,
        shipmentId,
        stableTimestamp,
        scope.userId,
        stableTimestamp,
        stableTimestamp,
      ],
    );
    await connection.query(
      `INSERT INTO InvoiceLine (
        id, companyId, invoiceId, description, quantity, unitPrice, amount,
        createdAt, updatedAt
      ) VALUES (?, ?, ?, 'Customer freight sell', 1, 1500, 1500, ?, ?)`,
      [invoiceLineId, scope.companyId, invoiceId, stableTimestamp, stableTimestamp],
    );
    await connection.query(
      `INSERT INTO ShipmentRequest (
        id, companyId, branchId, customerId, clientPortalAccountId, requestNo, status,
        shipmentType, transportMode, serviceScope, loadType, originCountry,
        originPort, destinationCountry, destinationPort, cargoDescription,
        customerReference, convertedShipmentJobId, source, createdAt, updatedAt
      ) VALUES (?, ?, ?, ?, ?, ?, 'CONVERTED', 'IMPORT', 'SEA', 'PORT_TO_PORT',
        'FCL', 'China', 'Shanghai', 'Bangladesh', 'Chattogram',
        'Phase 15 portal safety cargo', 'Phase 15 portal safety',
        ?, 'CLIENT_PORTAL', ?, ?)`,
      [
        requestId,
        scope.companyId,
        scope.branchId,
        scope.customerId,
        scope.accountId,
        requestNo,
        shipmentId,
        stableTimestamp,
        stableTimestamp,
      ],
    );

    return { customerId: scope.customerId, invoiceNo };
  } finally {
    await connection.end();
  }
}

test.describe("Phase 15 Finance Closeout and Profit Finalization", () => {
  test("Finance closeout blocks, exceptions, lock, guarded edits, payment posting, and portal safety", async ({ page, browser }) => {
    test.setTimeout(120_000);
    await loginAsCompanyAdmin(page);

    const created = await createShipmentAndOpen(page, "E2E-FIN");
    const financeCard = page.locator("#finance-closeout:visible");
    const financeUrl = () => `/dashboard/shipments/${created.shipmentId}?p15=${randomUUID()}#finance`;
    await page.goto(financeUrl());
    await waitForHydration(page);
    await page.getByRole("tab", { name: "Finance" }).click();

    await expect(financeCard.getByRole("heading", { name: "Finance Closeout" })).toBeVisible();
    await expect(financeCard.getByText(/payment posting, final profit snapshot, and finance closeout status/i)).toBeVisible();
    await expect(financeCard.getByText(/Next: review receivable and payable readiness before finance lock/i)).toBeVisible();
    await expect(financeCard.getByText("OPEN", { exact: true })).toBeVisible();
    await expect(financeCard.getByText("Customer invoice total")).toBeVisible();
    await expect(financeCard.getByText("Customer outstanding")).toBeVisible();
    await expect(financeCard.getByText("Vendor outstanding")).toBeVisible();
    await expect(financeCard.getByText("Missing customer invoice")).toBeVisible();
    await expect(financeCard.getByText("Mark Finance Close Ready")).toBeVisible();
    await expect(financeCard.getByText("Lock Finance / Finalize Profit")).toBeVisible();

    await financeCard.getByRole("button", { name: "Mark Finance Close Ready" }).click();
    await expect(financeCard.getByText(/Finance close is blocked/i)).toBeVisible({ timeout: 15_000 });
    await expect(financeCard.getByText("OPEN", { exact: true })).toBeVisible();

    const { customerId, invoiceNo } = await prepareFinanceData(created.shipmentId);
    await page.goto(financeUrl());
    await waitForHydration(page);
    await page.getByRole("tab", { name: "Finance" }).click();
    await expect(financeCard.getByText("Unpaid receivable")).toBeVisible();
    await expect(financeCard.getByText("Missing vendor bill decision")).toBeVisible();

    await financeCard.locator('input[name="allowUnpaidReceivableClose"]').check();
    await financeCard.locator('input[name="vendorPayablesNotApplicable"]').check();
    await financeCard.locator('textarea[name="notes"]').fill("Phase 15 finance close notes");
    await financeCard.getByRole("button", { name: "Update finance close exceptions" }).click();
    await expect(financeCard.getByText("Finance close exceptions updated.")).toBeVisible({ timeout: 15_000 });

    await financeCard.getByRole("button", { name: "Mark Finance Close Ready" }).click();
    await expect(financeCard.getByText("Finance marked close ready.")).toBeVisible({ timeout: 15_000 });
    await page.reload();
    await waitForHydration(page);
    await page.getByRole("tab", { name: "Finance" }).click();
    await expect(financeCard.getByText("CLOSE_READY", { exact: true })).toBeVisible();

    await financeCard.getByRole("button", { name: "Lock Finance / Finalize Profit" }).click();
    await expect(financeCard.getByText("LOCKED", { exact: true })).toBeVisible({ timeout: 15_000 });
    await page.reload();
    await waitForHydration(page);
    await page.getByRole("tab", { name: "Finance" }).click();
    await expect(financeCard.getByText("LOCKED", { exact: true })).toBeVisible();
    await expect(financeCard.getByText("Final sell amount")).toBeVisible();
    await expect(financeCard.getByText("Final buy amount")).toBeVisible();
    await expect(financeCard.getByText("Gross profit")).toBeVisible();
    await expect(financeCard.getByText("Profit margin")).toBeVisible();
    await expect(financeCard.getByText(/Payment posting after lock remains allowed/i)).toBeVisible();
    await expect(financeCard.getByRole("button", { name: "Mark Finance Close Ready" })).not.toBeVisible();
    await expect(financeCard.getByRole("button", { name: "Lock Finance / Finalize Profit" })).not.toBeVisible();

    const costingCard = page.locator("#costing");
    await costingCard.locator('input[name="chargeName"]').fill("Locked finance test cost");
    await costingCard.locator('input[name="buyRate"]').fill("100");
    await costingCard.locator('input[name="sellRate"]').fill("200");
    await costingCard.getByRole("button", { name: "Add cost item" }).click();
    await expect(costingCard.getByText("Finance is locked for this shipment.")).toBeVisible({ timeout: 15_000 });

    await page.goto("/dashboard/payments/received/new");
    await waitForHydration(page);
    await page.selectOption('select[name="customerId"]', customerId);
    const invoiceOption = page.locator('select[name="invoiceId"] option', { hasText: invoiceNo });
    await expect(invoiceOption).toHaveCount(1, { timeout: 15_000 });
    const invoiceValue = await invoiceOption.getAttribute("value");
    expect(invoiceValue).toBeTruthy();
    await page.selectOption('select[name="invoiceId"]', invoiceValue!);
    await page.selectOption('select[name="shipmentJobId"]', created.shipmentId);
    await page.fill('input[name="amount"]', "1500");
    await page.selectOption('select[name="paymentMethod"]', "BANK_TRANSFER");
    await page.getByRole("button", { name: "Record receipt" }).click();
    await expect(page.getByText(/Payment PAY-\d{4}-\d+ recorded\./)).toBeVisible({ timeout: 15_000 });

    const portal = await createPortalClientSession(browser, "demo-freight");
    try {
      await portal.page.goto(`/portal/demo-freight/shipments/${created.shipmentId}`);
      await waitForHydration(portal.page);
      await expect(portal.page.getByRole("heading", { name: "Shipment milestones" })).toBeVisible();

      const portalText = (await portal.page.locator("body").innerText()).toLowerCase();
      for (const forbidden of [
        "buy cost",
        "vendor bill",
        "profit",
        "margin",
        "internal finance notes",
        "final gross profit",
        "finance close notes",
        "phase 15 finance close notes",
      ]) {
        expect(portalText).not.toContain(forbidden);
      }
    } finally {
      await portal.context.close();
    }
  });
});
