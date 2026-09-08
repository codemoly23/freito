import { expect, test } from "@playwright/test";
import {
  createCompanyAdminSession,
  createPlatformSession,
  createPortalClientSession,
} from "./helpers/auth";

test.describe("Phase 8I Real Freight Operations", () => {
  test("Company Admin can create a carrier query and receive/select a proposal", async ({ browser }) => {
    const admin = await createCompanyAdminSession(browser);
    try {
      await admin.page.goto("/dashboard/carrier-queries/new");
      await admin.page.selectOption('select[name="shipmentJobId"]', { index: 1 });
      await admin.page.selectOption('select[name="vendorId"]', { index: 1 });
      await admin.page.fill('textarea[name="cargoSummary"]', "Customer-safe garments cargo");
      await admin.page.selectOption('select[name="status"]', "SENT");
      await admin.page.getByRole("button", { name: "Create query" }).click();
      await admin.page.waitForURL(/\/dashboard\/carrier-queries\/[^/]+$/);
      await admin.page.fill('input[name="buyingFreightAmount"]', "1200");
      await admin.page.fill('input[name="localCharges"]', "150");
      await admin.page.fill('input[name="providerReference"]', "PROVIDER-8I");
      await admin.page.getByRole("button", { name: "Record proposal" }).click();
      await expect(admin.page.getByText("PROVIDER-8I")).toBeVisible();
      await admin.page.getByRole("button", { name: "Select" }).click();
      await expect(admin.page.getByText("SELECTED", { exact: true }).first()).toBeVisible();
    } finally {
      await admin.context.close();
    }
  });

  test("Shipment operation page supports booking, SI, BL, pre-alert, release checks, and timeline", async ({ browser }) => {
    const admin = await createCompanyAdminSession(browser);
    try {
      await admin.page.goto("/dashboard/shipments");
      const href = await admin.page.getByRole("row").nth(1).getByRole("link", { name: "View" }).getAttribute("href");
      await admin.page.goto(`${href}/operations`);
      await expect(admin.page.getByRole("heading", { name: "Real operation timeline" })).toBeVisible();
      await expect(admin.page.getByRole("heading", { name: "Booking workflow" })).toBeVisible();
      await expect(admin.page.getByRole("heading", { name: "Shipping Instruction" })).toBeVisible();
      await expect(admin.page.getByRole("heading", { name: "Draft / Final BL or AWB" })).toBeVisible();
      await expect(admin.page.getByRole("heading", { name: "Destination-agent pre-alert" })).toBeVisible();
      await expect(admin.page.getByRole("heading", { name: "Destination release checklist" })).toBeVisible();
      const bookingCard = admin.page.getByRole("heading", { name: "Booking workflow" }).locator("../..");
      await bookingCard.locator('select[name="vendorId"]').selectOption({ index: 1 });
      await bookingCard.locator('select[name="status"]').selectOption("BOOKING_CONFIRMED");
      await bookingCard.getByRole("button", { name: "Save booking" }).click();
      // Scope the assertion to the booking card to avoid matching unrelated pages
      await expect(bookingCard.locator('select[name="status"]')).toHaveValue("BOOKING_CONFIRMED");
      const siCard = admin.page.getByRole("heading", { name: "Shipping Instruction" }).locator("../..");
      await siCard.locator('select[name="status"]').selectOption("SUBMITTED");
      await siCard.getByRole("button", { name: "Save SI" }).click();
      await expect(admin.page.getByText("SI Submitted", { exact: true }).first()).toBeVisible({ timeout: 15000 });
    } finally {
      await admin.context.close();
    }
  });

  test("Operation print is customer-safe and excludes internal buying fields", async ({ browser }) => {
    const admin = await createCompanyAdminSession(browser);
    try {
      await admin.page.goto("/dashboard/shipments");
      const href = await admin.page.getByRole("row").nth(1).getByRole("link", { name: "View" }).getAttribute("href");
      await admin.page.goto(`${href}/operations/print?type=pre-alert`);
      await expect(admin.page.getByRole("heading", { name: "PRE ALERT" })).toBeVisible();
      await expect(admin.page.locator("body")).not.toContainText(/buying freight|profit margin|vendor cost|internal notes/i);
    } finally {
      await admin.context.close();
    }
  });

  test("Portal and platform sessions cannot access dashboard operation routes", async ({ browser }) => {
    const portal = await createPortalClientSession(browser, "demo-freight");
    const platform = await createPlatformSession(browser);
    try {
      for (const page of [portal.page, platform.page]) {
        await page.goto("/dashboard/carrier-queries");
        await expect(page).not.toHaveURL(/\/dashboard\/carrier-queries$/);
        await page.goto("/dashboard/shipments/not-a-shipment/operations");
        await expect(page).not.toHaveURL(/\/dashboard\/shipments\/not-a-shipment\/operations$/);
      }
    } finally {
      await Promise.allSettled([portal.context.close(), platform.context.close()]);
    }
  });
});
