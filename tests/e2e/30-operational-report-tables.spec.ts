import { expect, test } from "@playwright/test";
import {
  createCompanyAdminSession,
  loginAsClientPortalUser,
  loginAsCompanyUser,
  loginAsPlatformOwner,
  waitForHydration,
} from "./helpers/auth";
import { createPortalOwnedShipment } from "./helpers/portal-owned-shipment";

test.describe("Phase 16C Operational Report Tables", () => {
  test("Operations report renders filters, table, and deterministic shipment drill-down", async ({ browser }) => {
    const admin = await createCompanyAdminSession(browser);
    try {
      const shipment = await createPortalOwnedShipment(admin.page, { prefix: "P16C-OPS", transportMode: "SEA" });

      await admin.page.goto("/dashboard/reports/operations");
      await waitForHydration(admin.page);

      await expect(admin.page.getByRole("heading", { name: "Operations Report" })).toBeVisible();
      await expect(admin.page.getByText("Shipment workload, delay signals, service scope, and finance close readiness.")).toBeVisible();
      await expect(admin.page.getByRole("heading", { name: "Filter this report" })).toBeVisible();
      await expect(admin.page.getByLabel("Customer")).toBeVisible();
      await expect(admin.page.getByLabel("Transport mode")).toBeVisible();
      await expect(admin.page.getByLabel("Load type")).toBeVisible();
      await expect(admin.page.getByLabel("Finance close status")).toBeVisible();
      await expect(admin.page.getByText("Shipment operation table")).toBeVisible();

      const operationTable = admin.page.locator("table").filter({
        has: admin.page.getByRole("columnheader", { name: "Shipment Type" }),
      });
      const shipmentRow = operationTable.getByRole("row").filter({ hasText: shipment.jobNo });
      await expect(shipmentRow).toBeVisible();
      await expect(shipmentRow.getByRole("link", { name: "View" })).toHaveAttribute("href", new RegExp(`/dashboard/shipments/${shipment.shipmentId}`));
    } finally {
      await admin.context.close();
    }
  });

  test("Quotation, document, and delivery report tables render stable headings", async ({ page }) => {
    await loginAsCompanyUser(page, "admin@freightcontrol.com");

    await page.goto("/dashboard/reports/quotations");
    await waitForHydration(page);
    await expect(page.getByRole("heading", { name: "Quotation & Sales Report" })).toBeVisible();
    await expect(page.getByText("Sales pipeline, customer quotes, conversion status, and linked job files.")).toBeVisible();
    await expect(page.getByText("Quotation report table")).toBeVisible();
    await expect(page.getByText("Converted quotations")).toBeVisible();

    await page.goto("/dashboard/reports/documents");
    await waitForHydration(page);
    await expect(page.getByRole("heading", { name: "Document Report" })).toBeVisible();
    await expect(page.getByText("Missing, verified, rejected, and client-visible freight documents.")).toBeVisible();
    await expect(page.getByText("Freight document status table")).toBeVisible();
    await expect(page.getByText("Client visible documents")).toBeVisible();
    await expect(page.getByRole("columnheader", { name: "Visible to Client" }).first()).toBeVisible();
    await expect(page.locator("body")).not.toContainText(/filePath|uploads\\|uploads\/|G:\\|C:\\/i);

    await page.goto("/dashboard/reports/workflow");
    await waitForHydration(page);
    await expect(page.getByRole("heading", { name: "Workflow / Delivery Report" })).toBeVisible();
    await expect(page.getByText("Delivery order, gate pass, cargo release, POD, and job closeout progress.")).toBeVisible();
    await expect(page.getByText("Delivery, POD, and closeout table")).toBeVisible();
    await expect(page.getByText("Delivery Order Pending")).toBeVisible();
    await expect(page.getByText("POD Verified")).toBeVisible();
  });

  test("Portal and platform sessions cannot access operational report routes", async ({ browser }) => {
    const portalContext = await browser.newContext();
    const portalPage = await portalContext.newPage();
    const platformContext = await browser.newContext();
    const platformPage = await platformContext.newPage();

    try {
      await loginAsClientPortalUser(portalPage, "demo-freight");
      for (const route of ["/dashboard/reports/operations", "/dashboard/reports/quotations", "/dashboard/reports/documents", "/dashboard/reports/workflow"]) {
        await portalPage.goto(route);
        await expect(portalPage).toHaveURL(/\/login\?error=wrong-portal/);
      }

      await loginAsPlatformOwner(platformPage);
      for (const route of ["/dashboard/reports/operations", "/dashboard/reports/quotations", "/dashboard/reports/documents", "/dashboard/reports/workflow"]) {
        await platformPage.goto(route);
        await expect(platformPage).toHaveURL(/\/login\?error=wrong-portal/);
      }
    } finally {
      await portalContext.close();
      await platformContext.close();
    }
  });

  test("Non-finance user does not see protected profit or vendor cost fields on operational reports", async ({ page }) => {
    await loginAsCompanyUser(page, "sales@freightcontrol.com");

    for (const route of ["/dashboard/reports/operations", "/dashboard/reports/quotations"]) {
      await page.goto(route);
      await waitForHydration(page);
      await expect(page.locator("body")).not.toContainText(/gross profit|final profit|vendor cost|buy rate|buy amount|payable due/i);
    }
  });
});
