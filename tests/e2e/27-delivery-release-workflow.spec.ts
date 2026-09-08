import "dotenv/config";
import { expect, test } from "@playwright/test";
import { loginAsCompanyAdmin, waitForHydration, createCompanyAdminSession, createPortalClientSession } from "./helpers/auth";
import { generateTestName } from "./helpers/test-data";
import mariadb from "mariadb";
import path from "path";
import { randomUUID } from "node:crypto";

async function createShipmentAndOpen(
  page: import("@playwright/test").Page,
  options: { prefix: string; serviceScope: "DOOR_TO_DOOR" | "PORT_TO_PORT" }
) {
  await page.goto("/dashboard/shipments/new");
  await waitForHydration(page);

  const jobRef = generateTestName(options.prefix);
  await page.fill('input[name="shipperName"]', jobRef);
  await page.selectOption('select[name="shipmentType"]', "IMPORT");
  await page.selectOption('select[name="transportMode"]', "SEA");
  await page.selectOption('select[name="loadType"]', "FCL");
  await page.selectOption('select[name="serviceScope"]', options.serviceScope);
  await page.selectOption('select[name="customerId"]', { index: 1 });
  await page.fill('input[name="originCountry"]', "China");
  await page.fill('input[name="originPort"]', "Shanghai");
  if (options.serviceScope === "DOOR_TO_DOOR") {
    await page.fill('textarea[name="pickupAddress"]', "Shanghai Warehouse A");
  }
  await page.fill('input[name="destinationCountry"]', "Bangladesh");
  await page.fill('input[name="destinationPort"]', "Chattogram");
  if (options.serviceScope === "DOOR_TO_DOOR") {
    await page.fill('textarea[name="deliveryAddress"]', "Dhaka Warehouse B");
  }
  await page.fill('textarea[name="cargoDescription"]', `${options.serviceScope} validation cargo`);
  await page.selectOption('select[name="assignedToId"]', { index: 1 });

  await page.getByRole("button", { name: "Create shipment" }).click();
  const created = await findShipmentByShipperName(jobRef);
  await page.goto(`/dashboard/shipments/${created.shipmentId}`);
  await waitForHydration(page);
  await page.getByRole("tab", { name: "Freight Documents" }).click();
  await expect(page.getByRole("heading", { name: "Delivery & Cargo Release Operations" })).toBeVisible();
  await expect(page.getByText(/Delivery Order, Gate Pass, Cargo Released, Out for Delivery, Delivered, POD Pending \/ POD Verified/i)).toBeVisible();
  await expect(page.getByText(/Next: complete required documents before delivery release/i).last()).toBeVisible();

  return {
    jobNo: created.jobNo,
    shipmentId: created.shipmentId,
  };
}

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

async function submitAndExpect(
  button: import("@playwright/test").Locator,
  state: import("@playwright/test").Locator
) {
  await button.click();
  await expect(state).toBeVisible({ timeout: 15_000 });
}

async function waitForShipmentClosed(shipmentId: string) {
  const connection = await createDbConnection();
  try {
    for (let attempt = 0; attempt < 60; attempt += 1) {
      const [shipment] = await connection.query<{ closedAt: Date | null }[]>(
        "SELECT closedAt FROM ShipmentJob WHERE id = ? AND deletedAt IS NULL LIMIT 1",
        [shipmentId],
      );
      if (shipment?.closedAt) return;
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
  } finally {
    await connection.end();
  }

  throw new Error(`Shipment ${shipmentId} was not closed.`);
}

async function waitForFreightDocumentStatus(
  shipmentId: string,
  type: string,
  status: string,
) {
  const connection = await createDbConnection();
  try {
    for (let attempt = 0; attempt < 60; attempt += 1) {
      const [document] = await connection.query<{ status: string }[]>(
        `SELECT status
         FROM FreightDocument
         WHERE shipmentJobId = ? AND type = ? AND deletedAt IS NULL
         ORDER BY updatedAt DESC
         LIMIT 1`,
        [shipmentId, type],
      );
      if (document?.status === status) return;
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
  } finally {
    await connection.end();
  }

  throw new Error(`${type} did not reach ${status} for shipment ${shipmentId}.`);
}

async function submitDocumentGateAndExpect(
  button: import("@playwright/test").Locator,
  shipmentId: string,
  type: string,
  status = "VERIFIED",
) {
  await button.click();
  await waitForFreightDocumentStatus(shipmentId, type, status);
}

async function connectShipmentToDemoPortalRequest(shipmentId: string) {
  const connection = await createDbConnection();

  try {
    const [scope] = await connection.query<{
      companyId: string;
      customerId: string;
      accountId: string;
    }[]>(
      `SELECT c.id AS companyId, cpa.customerId AS customerId, cpa.id AS accountId
       FROM Company c
       JOIN ClientPortalAccount cpa ON cpa.companyId = c.id
       WHERE c.portalSlug = ? AND cpa.deletedAt IS NULL AND cpa.displayClientCode = ?
       LIMIT 1`,
      ["demo-freight", "DFC-CL-2026-0001"],
    );
    expect(scope).toBeTruthy();

    const requestId = `req_${randomUUID().replace(/-/g, "")}`;
    const requestNo = `REQ-P14-${Date.now()}`;
    const stableTimestamp = new Date("2024-01-01T00:00:00.000Z");
    await connection.query(
      "UPDATE Customer SET deletedAt = NULL, updatedAt = ? WHERE id = ? AND companyId = ?",
      [stableTimestamp, scope.customerId, scope.companyId],
    );
    await connection.query(
      "UPDATE ShipmentJob SET customerId = ?, updatedAt = ? WHERE id = ? AND companyId = ?",
      [scope.customerId, stableTimestamp, shipmentId, scope.companyId],
    );
    await connection.query(
      `INSERT INTO ShipmentRequest (
        id, companyId, customerId, clientPortalAccountId, requestNo, status,
        shipmentType, transportMode, serviceScope, loadType, originCountry,
        originPort, destinationCountry, destinationPort, cargoDescription,
        customerReference, convertedShipmentJobId, source, createdAt, updatedAt
      ) VALUES (?, ?, ?, ?, ?, 'CONVERTED', 'IMPORT', 'SEA', 'PORT_TO_PORT',
        'FCL', 'China', 'Shanghai', 'Bangladesh', 'Chattogram',
        'Portal milestone validation cargo', 'Phase 14 portal visibility',
        ?, 'CLIENT_PORTAL', ?, ?)`,
      [
        requestId,
        scope.companyId,
        scope.customerId,
        scope.accountId,
        requestNo,
        shipmentId,
        stableTimestamp,
        stableTimestamp,
      ],
    );
  } finally {
    await connection.end();
  }
}

test.describe("Delivery, Release, POD, and Job Closeout Workflow", () => {
  test("DOOR_TO_DOOR Shipment lifecycle with required document gates and POD enforcement", async ({ page }) => {
    test.setTimeout(120_000);
    await loginAsCompanyAdmin(page);

    const created = await createShipmentAndOpen(page, { prefix: "E2E-D2D", serviceScope: "DOOR_TO_DOOR" });

    // 3. Mark Delivery Order Verified
    const deliveryOrderGate = page.getByTestId("delivery-order-gate");
    await submitDocumentGateAndExpect(
      deliveryOrderGate.getByRole("button", { name: "Verify" }),
      created.shipmentId,
      "DELIVERY_ORDER",
    );

    // 4. Mark Customs Release Verified
    const customsReleaseGate = page.getByTestId("customs-release-gate");
    await submitDocumentGateAndExpect(
      customsReleaseGate.getByRole("button", { name: "Verify" }),
      created.shipmentId,
      "CUSTOMS_RELEASE",
    );

    // 5. Mark Gate Pass Verified
    const gatePassGate = page.getByTestId("gate-pass-gate");
    await submitDocumentGateAndExpect(
      gatePassGate.getByRole("button", { name: "Verify" }),
      created.shipmentId,
      "GATE_PASS",
    );

    // 6. Release Cargo
    const releaseCargoForm = page.getByTestId("release-cargo-form");
    const releaseCargoBtn = releaseCargoForm.getByRole("button", { name: "Release Cargo" });
    await submitAndExpect(releaseCargoBtn, page.getByText("RELEASED", { exact: true }));

    // 7. Schedule Delivery
    await page.fill('input[name="deliveryLocation"]', "CFS Warehouse Dhaka");
    await page.fill('input[name="consigneeContact"]', "+88017000000");
    await page.fill('textarea[name="deliveryAddress"]', "123 Test Road, Dhaka, Bangladesh");
    await page.fill('input[name="deliveryDateTime"]', "2026-07-01T12:00");
    await page.fill('input[name="truckVehicleNo"]', "Dhaka-Metro-T-12-3456");
    await page.fill('input[name="driverName"]', "Driver John");
    await page.fill('input[name="driverPhone"]', "+88015000000");
    await submitAndExpect(
      page.getByRole("button", { name: "Save Schedule" }),
      page.getByText("SCHEDULED", { exact: true })
    );

    // 8. Out for Delivery
    const dispatchForm = page.getByTestId("out-for-delivery-form");
    const dispatchBtn = dispatchForm.getByRole("button", { name: "Dispatch" });
    await submitAndExpect(dispatchBtn, page.getByText("OUT FOR DELIVERY", { exact: true }));

    // 9. Mark Delivered
    const deliveredForm = page.getByTestId("confirm-delivery-form");
    const deliveredBtn = deliveredForm.getByRole("button", { name: "Delivered" });
    await submitAndExpect(deliveredBtn, page.getByText("DELIVERED", { exact: true }));

    // 10. Upload POD
    const uploadPodForm = page.getByTestId("pod-upload-form");
    await uploadPodForm.locator('input[name="podReferenceNo"]').fill("POD-REF-777");
    await uploadPodForm.locator('input[name="file"]').setInputFiles(path.join(__dirname, "fixtures", "sample-document.pdf"));
    await submitAndExpect(
      uploadPodForm.getByRole("button", { name: "Upload POD" }),
      page.getByText("RECEIVED", { exact: true }).first()
    );

    // 11. Verify POD
    const verifyPodForm = page.getByTestId("pod-verify-form");
    const verifyPodBtn = verifyPodForm.getByRole("button", { name: "Verify POD" });
    await submitDocumentGateAndExpect(verifyPodBtn, created.shipmentId, "POD");

    // 12. Verify & Mark Close Ready
    const closeReadyBtn = page.getByRole("button", { name: "Verify & Mark Close Ready" });
    await submitAndExpect(closeReadyBtn, page.getByText("Close Ready", { exact: true }));

    // 13. Close Job
    const closeJobBtn = page.getByRole("button", { name: "Close Job" });
    await closeJobBtn.click();
    await waitForShipmentClosed(created.shipmentId);
    await page.reload();
    await waitForHydration(page);
    await page.getByRole("tab", { name: "Freight Documents" }).click();
    await expect(page.getByText(/Closed on/)).toBeVisible({ timeout: 15_000 });
  });

  test("PORT_TO_PORT Shipment lifecycle does not require POD to close", async ({ page }) => {
    test.setTimeout(90_000);
    await loginAsCompanyAdmin(page);

    const created = await createShipmentAndOpen(page, { prefix: "E2E-P2P", serviceScope: "PORT_TO_PORT" });

    // 3. Mark DO and Customs Release Verified (no POD or scheduling required for P2P closeout)
    await submitDocumentGateAndExpect(
      page.getByTestId("delivery-order-gate").getByRole("button", { name: "Verify" }),
      created.shipmentId,
      "DELIVERY_ORDER",
    );
    await submitDocumentGateAndExpect(
      page.getByTestId("customs-release-gate").getByRole("button", { name: "Verify" }),
      created.shipmentId,
      "CUSTOMS_RELEASE",
    );

    // 4. Directly Verify & Mark Close Ready (POD should be bypassed since scope is PORT_TO_PORT)
    const closeReadyBtn = page.getByRole("button", { name: "Verify & Mark Close Ready" });
    await submitAndExpect(closeReadyBtn, page.getByText("Close Ready", { exact: true }));

    // 5. Close Job
    const closeJobBtn = page.getByRole("button", { name: "Close Job" });
    await closeJobBtn.click();
    await waitForShipmentClosed(created.shipmentId);
    await page.reload();
    await waitForHydration(page);
    await page.getByRole("tab", { name: "Freight Documents" }).click();
    await expect(page.getByText(/Closed on/)).toBeVisible({ timeout: 15_000 });
  });

  test("Client portal shows only safe milestones and hides sensitive costing/internal details", async ({ browser }) => {
    test.setTimeout(90_000);

    const admin = await createCompanyAdminSession(browser);
    let portal: Awaited<ReturnType<typeof createPortalClientSession>> | null = null;
    let shipmentId: string | null = null;
    try {
      const created = await createShipmentAndOpen(admin.page, {
        prefix: "E2E-PORTAL",
        serviceScope: "PORT_TO_PORT",
      });
      shipmentId = created.shipmentId;
      await connectShipmentToDemoPortalRequest(shipmentId);

      expect(shipmentId).toBeTruthy();

      // 2. Verify milestone safety from the client portal.
      portal = await createPortalClientSession(browser, "demo-freight");
      await portal.page.goto(`/portal/demo-freight/shipments/${shipmentId}`);
      await waitForHydration(portal.page);

      // Verify that the title of the card is Shipment milestones
      const milestonesCard = portal.page.getByRole("heading", { name: "Shipment milestones" });
      await expect(milestonesCard).toBeVisible();

      // Verify customer-safe milestone name: "Arrived at Destination Port" is visible
      await expect(portal.page.getByText("Arrived at Destination Port")).toBeVisible();

      // Check that internal remarks, costs, vendor/carrier cost, and buy rate are NOT on the page
      const content = await portal.page.content();
      expect(content).not.toContain("Internal Cost");
      expect(content).not.toContain("Buy Rate");
      expect(content).not.toContain("Profit Margin");
      expect(content).not.toContain("Vendor Bill");
      expect(content).not.toContain("Carrier Invoice");
      expect(content).not.toContain("Internal remarks");
    } finally {
      await Promise.allSettled([
        admin.context.close(),
        ...(portal ? [portal.context.close()] : []),
      ]);
    }
  });
});
