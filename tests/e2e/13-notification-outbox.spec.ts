import { expect, test } from "@playwright/test";
import {
  createCompanyAdminSession,
  createPlatformSession,
  createPortalClientSession,
  loginAsCompanyAdmin,
} from "./helpers/auth";
import { generateTestName } from "./helpers/test-data";

test.describe("Phase 8B Notification Templates and Delivery Outbox", () => {
  test("Company Admin can open templates and delivery outbox pages", async ({ page }) => {
    await loginAsCompanyAdmin(page);
    await page.goto("/dashboard/notification-templates");
    await expect(page.getByRole("heading", { name: "Notification Templates" })).toBeVisible();
    await expect(page.getByText("quotation_created", { exact: true }).first()).toBeVisible();
    await expect(page.getByText("EMAIL", { exact: true }).first()).toBeVisible();
    await expect(page.getByText("WHATSAPP", { exact: true }).first()).toBeVisible();

    await page.goto("/dashboard/notification-deliveries");
    await expect(page.getByRole("heading", { name: "Delivery Outbox" })).toBeVisible();
    await expect(page.getByText(/No provider sends are active/)).toBeVisible();
  });

  test("Portal and platform sessions cannot access company delivery pages", async ({ browser }) => {
    const portal = await createPortalClientSession(browser, "demo-freight");
    const platform = await createPlatformSession(browser);
    try {
      for (const path of ["/dashboard/notification-templates", "/dashboard/notification-deliveries"]) {
        await portal.page.goto(path);
        await expect(portal.page).not.toHaveURL(new RegExp(`${path}$`));
        await platform.page.goto(path);
        await expect(platform.page).not.toHaveURL(new RegExp(`${path}$`));
      }
    } finally {
      await Promise.allSettled([portal.context.close(), platform.context.close()]);
    }
  });

  test("Quotation creation prepares safe customer deliveries and admin can cancel one", async ({ browser }) => {
    const portal = await createPortalClientSession(browser, "demo-freight");
    const admin = await createCompanyAdminSession(browser);
    const requestRef = generateTestName("OUTBOX");
    try {
      await portal.page.goto("/portal/demo-freight/requests/new");
      await portal.page.selectOption('select[name="shipmentType"]', "IMPORT");
      await portal.page.selectOption('select[name="transportMode"]', "SEA");
      await portal.page.selectOption('select[name="serviceScope"]', "PORT_TO_PORT");
      await portal.page.fill('input[name="originCountry"]', "China");
      await portal.page.fill('input[name="originPort"]', "Shanghai");
      await portal.page.fill('input[name="destinationCountry"]', "Bangladesh");
      await portal.page.fill('input[name="destinationPort"]', "Chattogram");
      await portal.page.fill('textarea[name="cargoDescription"]', "Phase 8B safe delivery cargo");
      await portal.page.fill('input[name="customerReference"]', requestRef);
      await portal.page.getByRole("button", { name: "Submit shipment request" }).click();
      await expect(portal.page.getByText(/submitted/i)).toBeVisible();

      await portal.page.goto("/portal/demo-freight/requests");
      const requestNo = await portal.page.locator("a.block").first().locator("p.font-medium").innerText();
      await admin.page.goto("/dashboard/shipment-requests");
      const requestRow = admin.page.getByRole("row").filter({ hasText: requestNo });
      await requestRow.getByRole("link", { name: "View" }).click();
      await expect(admin.page.getByText(requestRef, { exact: true })).toBeVisible();
      await admin.page.getByRole("button", { name: "Create quotation", exact: true }).click();
      const success = admin.page.getByText(/Quotation QT-\d{4}-\d+ created\./);
      await expect(success).toBeVisible();
      const quoteNo = (await success.innerText()).match(/QT-\d{4}-\d+/)?.[0];
      expect(quoteNo).toBeTruthy();

      await admin.page.goto("/dashboard/notification-deliveries?status=PENDING");
      const emailDelivery = admin.page.locator("section > div.rounded-lg")
        .filter({ hasText: quoteNo! })
        .filter({ hasText: "EMAIL" })
        .first();
      const whatsappDelivery = admin.page.locator("section > div.rounded-lg")
        .filter({ hasText: quoteNo! })
        .filter({ hasText: "WHATSAPP" })
        .first();
      await expect(emailDelivery).toBeVisible();
      await expect(whatsappDelivery).toBeVisible();

      const deliverySource = `${await emailDelivery.innerText()} ${await whatsappDelivery.innerText()}`.toLowerCase();
      for (const unsafeText of [
        "internal cost",
        "buy cost",
        "gross profit",
        "profit margin",
        "vendor cost",
        "employee assignment",
        "agent assignment",
        "internal notes",
      ]) {
        expect(deliverySource).not.toContain(unsafeText);
      }

      await Promise.all([
        admin.page.waitForResponse((response) =>
          response.request().method() === "POST" &&
          response.url().includes("/dashboard/notification-deliveries"),
        ),
        emailDelivery.getByRole("button", { name: "Cancel" }).click(),
      ]);
      await expect(emailDelivery).toHaveCount(0);

      await admin.page.goto("/dashboard/notification-deliveries?status=CANCELLED");
      const cancelledDelivery = admin.page.locator("section > div.rounded-lg")
        .filter({ hasText: quoteNo! })
        .filter({ hasText: "EMAIL" })
        .first();
      await expect(cancelledDelivery).toBeVisible();
      await expect(cancelledDelivery.getByText("CANCELLED", { exact: true })).toBeVisible();
    } finally {
      await Promise.allSettled([portal.context.close(), admin.context.close()]);
    }
  });
});
