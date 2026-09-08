import "dotenv/config";
import { expect, test } from "@playwright/test";
import mariadb from "mariadb";
import {
  createCompanyAdminSession,
  createPortalClientSession,
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

async function getDemoPortalCustomer() {
  const connection = await createDbConnection();
  try {
    const [row] = await connection.query<{ customerId: string; customerName: string }[]>(
      `SELECT c.id AS customerId, c.name AS customerName
       FROM Customer c
       JOIN ClientPortalAccount cpa ON cpa.customerId = c.id
       JOIN Company co ON co.id = cpa.companyId
       WHERE co.portalSlug = ? AND cpa.displayClientCode = ? AND cpa.deletedAt IS NULL
       LIMIT 1`,
      ["demo-freight", "DFC-CL-2026-0001"],
    );
    expect(row).toBeTruthy();
    return row;
  } finally {
    await connection.end();
  }
}

async function getAdminUserId() {
  const connection = await createDbConnection();
  try {
    const [row] = await connection.query<{ id: string }[]>(
      "SELECT id FROM User WHERE email = ? LIMIT 1",
      ["admin@freightcontrol.com"],
    );
    expect(row).toBeTruthy();
    return row.id;
  } finally {
    await connection.end();
  }
}

async function waitForFreightDocumentStatus(shipmentId: string, type: string, status: string) {
  const connection = await createDbConnection();
  try {
    for (let attempt = 0; attempt < 60; attempt += 1) {
      const [document] = await connection.query<{ status: string }[]>(
        `SELECT status FROM FreightDocument WHERE shipmentJobId = ? AND type = ? AND deletedAt IS NULL ORDER BY updatedAt DESC LIMIT 1`,
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

async function countNotificationDeliveries(messageBodyContains: string, channel: string) {
  const connection = await createDbConnection();
  try {
    const rows = await connection.query<{ count: bigint }[]>(
      `SELECT COUNT(*) AS count FROM NotificationDelivery WHERE messageBody LIKE ? AND channel = ? AND deletedAt IS NULL`,
      [`%${messageBodyContains}%`, channel],
    );
    return Number(rows[0].count);
  } finally {
    await connection.end();
  }
}

async function createInvoiceForDemoCustomer(page: import("@playwright/test").Page, customerId: string) {
  await page.goto("/dashboard/invoices/new");
  await waitForHydration(page);
  await page.waitForSelector('select[name="customerId"]');
  await page.selectOption('select[name="customerId"]', customerId);
  const invoiceDate = new Date().toISOString().split("T")[0];
  await page.fill('input[name="invoiceDate"]', invoiceDate);
  await page.waitForSelector('input[name="lineDescription"]');
  await page.fill('input[name="lineDescription"]', "Phase 02 notification QA freight charge");
  await page.fill('input[name="lineQuantity"]', "1");
  await page.fill('input[name="lineUnitPrice"]', "2500");
  await page.getByRole("button", { name: "Create invoice" }).click();
  const alert = page.getByText(/Invoice INV-\d{4}-\d+ created\./);
  await expect(alert).toBeVisible({ timeout: 10_000 });
  const invoiceNo = (await alert.innerText()).match(/INV-\d{4}-\d+/)?.[0];
  expect(invoiceNo).toBeTruthy();
  return invoiceNo!;
}

test.describe("Phase 02 Automated Status Notifications", () => {
  test("invoice created/sent notifications reach the assigned staff member and the customer portal without leaking internal figures", async ({ browser }) => {
    test.setTimeout(60_000);
    const admin = await createCompanyAdminSession(browser);
    let portal: Awaited<ReturnType<typeof createPortalClientSession>> | null = null;
    try {
      const customer = await getDemoPortalCustomer();
      const invoiceNo = await createInvoiceForDemoCustomer(admin.page, customer.customerId);

      // In-app: creator sees "invoice created" immediately (automatic, no approval needed).
      await admin.page.goto("/dashboard/notifications");
      await expect(admin.page.getByText(invoiceNo, { exact: false }).first()).toBeVisible({ timeout: 10_000 });

      // Mark the invoice sent -- this is the customer-facing event.
      await admin.page.goto("/dashboard/invoices");
      await admin.page.getByRole("row").filter({ hasText: invoiceNo }).getByRole("link").first().click();
      await admin.page.getByRole("button", { name: "Mark sent" }).click();
      await expect(admin.page.getByText("SENT", { exact: true }).first()).toBeVisible({ timeout: 10_000 });

      // Portal: the customer sees an in-app notification for the same invoice.
      portal = await createPortalClientSession(browser, "demo-freight");
      await portal.page.goto("/portal/demo-freight/notifications");
      const portalCard = portal.page.getByText(invoiceNo, { exact: false }).first();
      await expect(portalCard).toBeVisible({ timeout: 10_000 });
      const portalSource = await portal.page.content();
      for (const internalText of ["Buy Cost", "Internal Cost", "Gross Profit", "Margin", "Vendor Cost"]) {
        expect(portalSource).not.toContain(internalText);
      }

      // Outbox: the customer's active portal account gets a PENDING EMAIL delivery for this invoice,
      // created automatically -- but real sending stays manual-approval by default (no autoSendApproved override).
      await admin.page.goto("/dashboard/notification-deliveries?status=PENDING");
      const emailDelivery = admin.page.locator("section > div.rounded-lg").filter({ hasText: invoiceNo }).filter({ hasText: "EMAIL" }).first();
      await expect(emailDelivery).toBeVisible({ timeout: 10_000 });
    } finally {
      await Promise.allSettled([admin.context.close(), ...(portal ? [portal.context.close()] : [])]);
    }
  });

  test("cron dispatch endpoint rejects requests without the correct shared secret", async ({ request }) => {
    const noHeader = await request.post("/api/cron/notification-dispatch");
    expect(noHeader.status()).toBe(401);

    const wrongHeader = await request.post("/api/cron/notification-dispatch", {
      headers: { "x-dispatch-secret": "not-the-real-secret" },
    });
    expect(wrongHeader.status()).toBe(401);
  });

  test("marking an invoice sent twice does not create a duplicate outbox delivery", async ({ browser }) => {
    test.setTimeout(60_000);
    const admin = await createCompanyAdminSession(browser);
    const second = await createCompanyAdminSession(browser);
    try {
      const customer = await getDemoPortalCustomer();
      const invoiceNo = await createInvoiceForDemoCustomer(admin.page, customer.customerId);

      await admin.page.goto("/dashboard/invoices");
      await admin.page.getByRole("row").filter({ hasText: invoiceNo }).getByRole("link", { name: "View" }).click();
      await admin.page.waitForURL(/\/dashboard\/invoices\/[a-zA-Z0-9-]+$/, { timeout: 10_000 });
      await waitForHydration(admin.page);
      const invoiceUrl = admin.page.url();
      await second.page.goto(invoiceUrl);
      await waitForHydration(second.page);
      await expect(second.page.getByRole("button", { name: "Mark sent" })).toBeVisible({ timeout: 10_000 });

      // Two sessions race to send the same invoice at (almost) the same time.
      await Promise.all([
        admin.page.getByRole("button", { name: "Mark sent" }).click(),
        second.page.getByRole("button", { name: "Mark sent" }).click(),
      ]);
      await expect(admin.page.getByText("SENT", { exact: true }).first()).toBeVisible({ timeout: 10_000 });

      const emailDeliveryCount = await countNotificationDeliveries(invoiceNo, "EMAIL");
      expect(emailDeliveryCount).toBe(1);
    } finally {
      await Promise.allSettled([admin.context.close(), second.context.close()]);
    }
  });

  test("delivery milestone verification raises an internal notification for the assigned staff member", async ({ browser }) => {
    // Scoped to customs-release and gate-pass -- the only two of the nine
    // delivery-release milestones with no prerequisite document-upload gate
    // (markDeliveryOrderAction/markCargoReleasedAction additionally require an
    // already-uploaded, transport-mode-specific mandatory document via
    // canReleaseDelivery(), which is a pre-existing, Phase-02-unrelated
    // product rule -- out of scope to set up here). The dispatch call these
    // two milestones make is the exact same dispatchNotificationEvent/
    // notifyDeliveryEvent helper every one of the nine call sites uses, so
    // this exercises the shared wiring, not milestone-specific logic.
    test.setTimeout(90_000);
    const admin = await createCompanyAdminSession(browser);
    try {
      const adminUserId = await getAdminUserId();
      const jobRef = generateTestName("E2E-NOTIFY-D2D");

      await admin.page.goto("/dashboard/shipments/new");
      await waitForHydration(admin.page);
      await admin.page.fill('input[name="shipperName"]', jobRef);
      await admin.page.selectOption('select[name="shipmentType"]', "IMPORT");
      await admin.page.selectOption('select[name="transportMode"]', "SEA");
      await admin.page.selectOption('select[name="loadType"]', "FCL");
      await admin.page.selectOption('select[name="serviceScope"]', "DOOR_TO_DOOR");
      await admin.page.selectOption('select[name="customerId"]', { index: 1 });
      await admin.page.fill('input[name="originCountry"]', "China");
      await admin.page.fill('input[name="originPort"]', "Shanghai");
      await admin.page.fill('textarea[name="pickupAddress"]', "Shanghai Warehouse A");
      await admin.page.fill('input[name="destinationCountry"]', "Bangladesh");
      await admin.page.fill('input[name="destinationPort"]', "Chattogram");
      await admin.page.fill('textarea[name="deliveryAddress"]', "Dhaka Warehouse B");
      await admin.page.fill('textarea[name="cargoDescription"]', "Phase 02 delivery-milestone notification QA cargo");
      await admin.page.selectOption('select[name="assignedToId"]', adminUserId);
      await admin.page.getByRole("button", { name: "Create shipment" }).click();

      const connection = await createDbConnection();
      let shipmentId = "";
      let jobNo = "";
      try {
        for (let attempt = 0; attempt < 30; attempt += 1) {
          const [shipment] = await connection.query<{ id: string; jobNo: string }[]>(
            "SELECT id, jobNo FROM ShipmentJob WHERE shipperName = ? AND deletedAt IS NULL ORDER BY createdAt DESC LIMIT 1",
            [jobRef],
          );
          if (shipment) {
            shipmentId = shipment.id;
            jobNo = shipment.jobNo;
            break;
          }
          await new Promise((resolve) => setTimeout(resolve, 500));
        }
      } finally {
        await connection.end();
      }
      expect(shipmentId).toBeTruthy();

      await admin.page.goto(`/dashboard/shipments/${shipmentId}`);
      await waitForHydration(admin.page);
      await admin.page.getByRole("tab", { name: "Freight Documents" }).click();

      await admin.page.getByTestId("customs-release-gate").getByRole("button", { name: "Verify" }).click();
      await waitForFreightDocumentStatus(shipmentId, "CUSTOMS_RELEASE", "VERIFIED");
      await admin.page.getByTestId("gate-pass-gate").getByRole("button", { name: "Verify" }).click();
      await waitForFreightDocumentStatus(shipmentId, "GATE_PASS", "VERIFIED");

      await admin.page.goto("/dashboard/notifications");
      const cards = admin.page.locator('[class*="rounded-lg"]').filter({ hasText: jobNo });
      await expect(cards.first()).toBeVisible({ timeout: 10_000 });
      await expect(cards).toHaveCount(2);
    } finally {
      await admin.context.close();
    }
  });
});
