import "dotenv/config";
import { expect, test } from "@playwright/test";
import mariadb from "mariadb";
import { randomUUID } from "node:crypto";
import {
  createCompanyAdminSession,
  createPortalClientSession,
  waitForHydration,
} from "./helpers/auth";
import { generateTestName } from "./helpers/test-data";
import path from "path";

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

async function createShipmentAndOpen(page: import("@playwright/test").Page) {
  await page.goto("/dashboard/shipments/new");
  await waitForHydration(page);

  const jobRef = generateTestName("PORTAL-DOC");
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
  await page.fill('textarea[name="cargoDescription"]', "Portal secure download validation cargo");
  await page.selectOption('select[name="assignedToId"]', { index: 1 });
  await page.getByRole("button", { name: "Create shipment" }).click();

  const created = await findShipmentByShipperName(jobRef);
  await linkShipmentToDemoPortal(created.shipmentId);
  await page.goto(`/dashboard/shipments/${created.shipmentId}#freight-documents`);
  await waitForHydration(page);

  return created;
}

async function linkShipmentToDemoPortal(shipmentId: string) {
  const connection = await createDbConnection();
  const stableTimestamp = new Date("2024-01-03T00:00:00.000Z");

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
    const requestNo = `REQ-P26-${randomUUID().slice(0, 8).toUpperCase()}`;

    await connection.query(
      `UPDATE Customer
       SET deletedAt = NULL, updatedAt = ?
       WHERE id = ? AND companyId = ?`,
      [stableTimestamp, scope.customerId, scope.companyId],
    );
    await connection.query(
      `UPDATE ShipmentJob
       SET customerId = ?, updatedAt = ?
       WHERE id = ? AND companyId = ?`,
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
        'Portal secure document validation cargo', 'Phase 26 portal documents',
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

test.describe("Portal Secure Document Download and Visibility", () => {
  test("Client portal download security and visibility rules", async ({ browser }) => {
    test.setTimeout(90_000);
    // 1. Log in as Company Admin to upload external documents
    const admin = await createCompanyAdminSession(browser);
    let shipmentId: string | null = null;
    let ciDocId: string | null = null;
    let vdnDocId: string | null = null;
    let docNo: string | null = null;

    try {
      const created = await createShipmentAndOpen(admin.page);
      shipmentId = created.shipmentId;

      // --- Register Whitelisted CLIENT_SAFE Document (Commercial Invoice) ---
      const regBtn = admin.page.getByRole("button", { name: "Register External Document" });
      await expect(regBtn).toBeVisible();
      await regBtn.click();

      const externalDocForm = admin.page.locator("form").filter({ hasText: "Register External Document" });
      await expect(externalDocForm).toBeVisible();
      await externalDocForm.locator('select[name="type"]').selectOption("COMMERCIAL_INVOICE");
      await externalDocForm.locator('input[name="referenceNo"]').fill("CI-PORTAL-SAFE-999");
      await externalDocForm.locator('input[name="remarks"]').fill("Client safe remarks");
      
      const fileInput = externalDocForm.locator('input[name="file"]');
      await fileInput.setInputFiles(path.join(__dirname, "fixtures", "sample-document.pdf"));

      await externalDocForm.getByRole("button", { name: "Register Document" }).click();
      
      const successMsg = admin.page.getByText(/Registered COMMERCIAL INVOICE successfully/i);
      await expect(successMsg).toBeVisible({ timeout: 15_000 });
      const successText = await successMsg.innerText();
      const docNoMatch = successText.match(/CI-\d{4}-\d+/);
      docNo = docNoMatch ? docNoMatch[0] : null;
      expect(docNo).toBeTruthy();

      // Find the row for this document and publish to portal
      const ciRow = admin.page.locator("tr", { hasText: docNo! });
      
      // Extract document ID from link href
      const ciLink = ciRow.locator('a[href*="/freight-documents/"]').first();
      const ciEditHref = await ciLink.getAttribute("href");
      expect(ciEditHref).toBeTruthy();
      ciDocId = ciEditHref!.split("/").pop() || null;

      const ciPublishBtn = ciRow.getByRole("button", { name: "Publish to Portal" });
      await expect(ciPublishBtn).toBeVisible();
      await ciPublishBtn.click();
      await expect(ciRow.getByRole("button", { name: "Hide from Portal" })).toBeVisible({ timeout: 10_000 });

      // --- Register Blocklisted Document (Vendor Debit Note) ---
      if (await regBtn.isVisible()) {
        await regBtn.click();
      }
      await expect(externalDocForm).toBeVisible();
      await externalDocForm.locator('select[name="type"]').selectOption("VENDOR_DEBIT_NOTE");
      await externalDocForm.locator('input[name="referenceNo"]').fill("VDN-BLOCK-999");
      await externalDocForm.locator('input[name="file"]').setInputFiles(path.join(__dirname, "fixtures", "sample-document.pdf"));
      await externalDocForm.getByRole("button", { name: "Register Document" }).click();
      
      const vdnSuccessMsg = admin.page.getByText(/Registered VENDOR DEBIT NOTE successfully/i);
      await expect(vdnSuccessMsg).toBeVisible({ timeout: 15_000 });
      const vdnSuccessText = await vdnSuccessMsg.innerText();
      const vdnDocNoMatch = vdnSuccessText.match(/VDN-\d{4}-\d+/);
      const vdnDocNo = vdnDocNoMatch ? vdnDocNoMatch[0] : null;
      expect(vdnDocNo).toBeTruthy();

      // Publish VDN to portal (client visible)
      const vdnRow = admin.page.locator("tr", { hasText: vdnDocNo! });

      // Extract document ID from link href
      const vdnLink = vdnRow.locator('a[href*="/freight-documents/"]').first();
      const vdnEditHref = await vdnLink.getAttribute("href");
      expect(vdnEditHref).toBeTruthy();
      vdnDocId = vdnEditHref!.split("/").pop() || null;

      const vdnPublishBtn = vdnRow.getByRole("button", { name: "Publish to Portal" });
      await expect(vdnPublishBtn).toBeVisible();
      await vdnPublishBtn.click();
      await expect(vdnRow.getByRole("button", { name: "Hide from Portal" })).toBeVisible({ timeout: 10_000 });

    } finally {
      await admin.context.close();
    }

    expect(ciDocId).toBeTruthy();
    expect(vdnDocId).toBeTruthy();

    // 2. Log in as Client Portal Account
    const portal = await createPortalClientSession(browser, "demo-freight");
    try {
      await portal.page.goto(`/portal/demo-freight/shipments/${shipmentId}`);
      await waitForHydration(portal.page);

      // VERIFY: Commercial Invoice is visible in the Review & Approvals card list
      const ciPortalLink = portal.page.locator(`a[href*="/freight-documents/${ciDocId}"]`).first();
      await expect(ciPortalLink).toBeVisible();

      // VERIFY: Vendor Debit Note is NOT visible in the portal list
      const vdnPortalLink = portal.page.locator(`a[href*="/freight-documents/${vdnDocId}"]`).first();
      await expect(vdnPortalLink).not.toBeVisible();

      // Go to the Commercial Invoice detail view in portal
      await ciPortalLink.click();
      await waitForHydration(portal.page);

      // VERIFY: The details page shows the whitelisted fields but no internal remarks
      await expect(portal.page.getByText("COMMERCIAL_INVOICE Draft Details")).toBeVisible();
      await expect(portal.page.getByText(docNo!).first()).toBeVisible();
      await expect(portal.page.locator("body")).not.toContainText("Client safe remarks"); // Internal remarks database field not rendered
      await expect(portal.page.locator("body")).not.toContainText("G:\\");
      await expect(portal.page.locator("body")).not.toContainText("document-storage");

      // VERIFY: Secure download button is visible and clickable
      const downloadBtn = portal.page.getByRole("link", { name: /Download Attachment/i });
      await expect(downloadBtn).toBeVisible();
      const downloadHref = await downloadBtn.getAttribute("href");
      expect(downloadHref).toBeTruthy();

      // Download the file securely
      const downloadPromise = portal.page.waitForEvent("download");
      await downloadBtn.click();
      await downloadPromise;

      // VERIFY: Direct URL guessing for detail page and download route of the Vendor Debit Note returns 404
      const vdnDetailUrl = `/portal/demo-freight/shipments/${shipmentId}/freight-documents/${vdnDocId}`;
      const vdnDownloadUrl = `/api/portal/demo-freight/documents/${vdnDocId}/download`;

      // Try detail page access
      await portal.page.goto(vdnDetailUrl);
      // Since nextjs renders notFound() which triggers the global not-found page
      await expect(portal.page.getByText(/could not be found|404/i).first()).toBeVisible();

      // Try download route access for logged-in portal user
      const portalResponse = await portal.page.request.get(vdnDownloadUrl);
      expect(portalResponse.status()).toBe(404);

      // Try anonymous download access
      const anonymousContext = await browser.newContext();
      try {
        const anonResp = await anonymousContext.request.get(vdnDownloadUrl);
        expect(anonResp.status()).toBe(404);
        expect(await anonResp.text()).toBe("Not found");
      } finally {
        await anonymousContext.close();
      }
    } finally {
      await portal.context.close();
    }
  });
});
