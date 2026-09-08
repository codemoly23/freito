import { expect, test } from "@playwright/test";
import {
  createCompanyAdminSession,
  createPlatformSession,
  createPortalClientSession,
  waitForHydration,
} from "./helpers/auth";

test.describe("Phase 11 Freight Document Generator Core", () => {
  test("Company Admin can open the Freight Documents tab on a shipment", async ({ browser }) => {
    const admin = await createCompanyAdminSession(browser);
    try {
      await admin.page.goto("/dashboard/shipments");
      const href = await admin.page
        .getByRole("row")
        .nth(1)
        .getByRole("link", { name: "View" })
        .getAttribute("href");
      await admin.page.goto(href!);
      await waitForHydration(admin.page);
      // Navigate to the "Freight Documents" tab
      await admin.page.getByRole("tab", { name: "Freight Documents" }).click();
      // Section heading should exist
      await expect(
        admin.page.getByRole("heading", { name: /Generated Freight Documents/i })
      ).toBeVisible();
      // Generate button should be present
      await expect(admin.page.getByRole("button", { name: /Generate/i }).first()).toBeVisible();
    } finally {
      await admin.context.close();
    }
  });

  test("Company Admin can generate a new HBL document and see it in the list", async ({ browser }) => {
    const admin = await createCompanyAdminSession(browser);
    let shipmentHref: string | null = null;
    try {
      await admin.page.goto("/dashboard/shipments");
      shipmentHref = await admin.page
        .getByRole("row")
        .nth(1)
        .getByRole("link", { name: "View" })
        .getAttribute("href");
      await admin.page.goto(`${shipmentHref}#freight-documents`);
      // Select HBL type and generate
      const typeSelect = admin.page.locator('select[name="type"]');
      await typeSelect.selectOption("HBL");
      await admin.page.getByRole("button", { name: /Generate/i }).first().click();
      // After generation, a success message or a row with HBL should appear
      await expect(
        admin.page.getByText(/HBL/i).first()
      ).toBeVisible({ timeout: 10_000 });
    } finally {
      await admin.context.close();
    }
  });

  test("Company Admin can delete an unused DRAFT generated freight document", async ({ browser }) => {
    const admin = await createCompanyAdminSession(browser);
    try {
      await admin.page.goto("/dashboard/shipments");
      await waitForHydration(admin.page);
      const href = await admin.page
        .getByRole("row")
        .nth(1)
        .getByRole("link", { name: "View" })
        .getAttribute("href");

      await admin.page.goto(`${href}#freight-documents`);
      await waitForHydration(admin.page);

      await admin.page.locator('select[name="type"]').selectOption("ARRIVAL_NOTICE");
      await admin.page.getByRole("button", { name: /Generate Draft/i }).click();
      await expect(admin.page.getByText(/Created ARRIVAL_NOTICE successfully:/i)).toBeVisible({
        timeout: 10_000,
      });

      const draftRow = admin.page
        .locator("#freight-documents")
        .getByRole("row")
        .filter({ hasText: "ARRIVAL_NOTICE" })
        .filter({ hasText: "DRAFT" })
        .filter({ hasText: "Delete Draft" })
        .first();
      await expect(draftRow).toBeVisible({ timeout: 10_000 });
      const documentNo = (await draftRow.getByRole("link").first().textContent())?.trim();
      expect(documentNo).toBeTruthy();

      admin.page.once("dialog", async (dialog) => {
        expect(dialog.message()).toContain("Delete draft document?");
        await dialog.accept();
      });
      await draftRow.getByRole("button", { name: "Delete Draft" }).click();
      await expect(
        admin.page.locator("#freight-documents").getByRole("row").filter({ hasText: documentNo! })
      ).toHaveCount(0, { timeout: 10_000 });
    } finally {
      await admin.context.close();
    }
  });

  test("Delete Draft is hidden for locked and client-visible freight documents", async ({ browser }) => {
    const admin = await createCompanyAdminSession(browser);
    try {
      await admin.page.goto("/dashboard/shipments");
      await waitForHydration(admin.page);
      const href = await admin.page
        .getByRole("row")
        .nth(1)
        .getByRole("link", { name: "View" })
        .getAttribute("href");

      await admin.page.goto(`${href}#freight-documents`);
      await waitForHydration(admin.page);

      const lockedRows = admin.page
        .locator("#freight-documents")
        .getByRole("row")
        .filter({ hasText: "LOCKED" });
      if ((await lockedRows.count()) > 0) {
        await expect(lockedRows.first().getByRole("button", { name: "Delete Draft" })).toHaveCount(0);
      }

      await admin.page.locator('select[name="type"]').selectOption("ARRIVAL_NOTICE");
      await admin.page.getByRole("button", { name: /Generate Draft/i }).click();
      await expect(admin.page.getByText(/Created ARRIVAL_NOTICE successfully:/i)).toBeVisible({
        timeout: 10_000,
      });

      const draftRow = admin.page
        .locator("#freight-documents")
        .getByRole("row")
        .filter({ hasText: "ARRIVAL_NOTICE" })
        .filter({ hasText: "DRAFT" })
        .filter({ hasText: "Delete Draft" })
        .first();
      await expect(draftRow).toBeVisible({ timeout: 10_000 });
      const documentNo = (await draftRow.getByRole("link").first().textContent())?.trim();
      expect(documentNo).toBeTruthy();

      await draftRow.getByRole("button", { name: "Publish to Portal" }).click();
      await expect(
        admin.page
          .locator("#freight-documents")
          .getByRole("row")
          .filter({ hasText: documentNo! })
          .getByRole("button", { name: "Delete Draft" })
      ).toHaveCount(0, { timeout: 10_000 });
    } finally {
      await admin.context.close();
    }
  });

  test("Company Admin can open the freight document detail page", async ({ browser }) => {
    const admin = await createCompanyAdminSession(browser);
    try {
      await admin.page.goto("/dashboard/shipments");
      await waitForHydration(admin.page);
      const href = await admin.page
        .getByRole("row")
        .nth(1)
        .getByRole("link", { name: "View" })
        .getAttribute("href");
      await admin.page.goto(href!);
      await waitForHydration(admin.page);
      // Navigate to the "Freight Documents" tab
      await admin.page.getByRole("tab", { name: "Freight Documents" }).click();

      // The freight documents section uses "Edit / Manage" (draft) or "View Details" (locked)
      const docViewLink = admin.page.getByRole("link", { name: /Edit \/ Manage|View Details/i });
      const docViewCount = await docViewLink.count();
      if (docViewCount > 0) {
        const docHref = await docViewLink.first().getAttribute("href");
        await admin.page.goto(docHref!);
        await waitForHydration(admin.page);
        await expect(admin.page.getByRole("heading", { name: /Freight Document|Manage Freight Document/i })).toBeVisible();
      } else {
        // If no document exists yet, the empty-state text should be visible
        await expect(
          admin.page.locator("#freight-documents").getByText(/No freight documents generated or registered yet/i)
        ).toBeVisible();
      }
    } finally {
      await admin.context.close();
    }
  });

  test("Portal client cannot access backoffice freight document pages", async ({ browser }) => {
    const portal = await createPortalClientSession(browser, "demo-freight");
    try {
      // Attempt direct access to a backoffice freight document route
      await portal.page.goto("/dashboard/shipments");
      await expect(portal.page).not.toHaveURL(/\/dashboard\/shipments$/);
    } finally {
      await portal.context.close();
    }
  });

  test("Platform session cannot access company freight document pages", async ({ browser }) => {
    const platform = await createPlatformSession(browser);
    try {
      await platform.page.goto("/dashboard/shipments");
      await expect(platform.page).not.toHaveURL(/\/dashboard\/shipments$/);
    } finally {
      await platform.context.close();
    }
  });

  test("Client portal shipment page shows freight documents section when visible docs exist", async ({ browser }) => {
    const portal = await createPortalClientSession(browser, "demo-freight");
    try {
      // Navigate to portal shipments list
      await portal.page.goto("/portal/demo-freight/shipments");
      const firstShipmentLink = portal.page.getByRole("link", { name: /View|Details/i }).first();
      const shipmentCount = await firstShipmentLink.count();
      if (shipmentCount > 0) {
        await firstShipmentLink.click();
        // The page should be accessible and should NOT expose internal fields
        await expect(portal.page.locator("body")).not.toContainText(
          /buy rate|profit margin|vendor cost|internal notes|buying freight/i
        );
        // Freight documents section should exist in the portal page
        await expect(
          portal.page.getByText(/Freight Documents|Generated Documents|Shared Documents/i).first()
        ).toBeVisible({ timeout: 5_000 });
      }
    } finally {
      await portal.context.close();
    }
  });

  test("Freight document detail page for backoffice requires authentication", async ({ browser }) => {
    const context = await browser.newContext();
    const page = await context.newPage();
    try {
      // Try accessing a freight document page without logging in
      await page.goto("/dashboard/shipments/non-existent-id/freight-documents/non-existent-doc");
      // Should be redirected to login
      await expect(page).not.toHaveURL(/\/dashboard\/shipments\/.+\/freight-documents\/.+/);
    } finally {
      await context.close();
    }
  });
});
