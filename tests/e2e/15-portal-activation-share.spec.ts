import { expect, test } from "@playwright/test";
import { loginAsCompanyAdmin, waitForHydration } from "./helpers/auth";
import { generateTestEmail, generateTestName } from "./helpers/test-data";

test.describe("Phase 8E Portal Activation and Client Sharing", () => {
  test("Portal access invitation creates three safe deliveries and activates once", async ({ page, browser }) => {
    await loginAsCompanyAdmin(page);
    const customerName = generateTestName("Invite Customer");
    const email = generateTestEmail("invite");
    const phone = "+8801712345678";
    await page.goto("/dashboard/customers");
    await page.fill('input[name="name"]', customerName);
    await page.fill('input[name="email"]', email);
    await page.fill('input[name="phone"]', phone);
    await page.getByRole("button", { name: "Create customer" }).click();
    const row = page.getByRole("row").filter({ hasText: customerName });
    await expect(row).toBeVisible();
    await row.getByRole("link", { name: "Portal" }).click();

    await expect(page.getByRole("button", { name: "Send Portal Access" })).toBeVisible();
    await page.getByRole("button", { name: "Send Portal Access" }).click();
    await expect(page.getByText("INVITED", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Resend Portal Access" }).click();
    const activationLink = await page.getByLabel("Activation link").inputValue();
    expect(activationLink).toContain("/portal/demo-freight/activate?token=");
    const clientId = await page.getByRole("heading", { level: 3 }).first().innerText();
    for (const channel of ["EMAIL", "WHATSAPP", "SMS"]) {
      await expect(page.getByText(channel, { exact: true })).toBeVisible();
    }
    const source = (await page.content()).toLowerCase();
    expect(source).not.toContain("temporary password");
    expect(source).not.toContain("permanent password");

    await page.goto(activationLink);
    await waitForHydration(page);
    await page.fill('input[name="password"]', "Activated123");
    await page.fill('input[name="confirmPassword"]', "Activated123");
    await page.getByRole("button", { name: "Activate portal access" }).click();
    await expect(page.getByText(/Portal access activated/)).toBeVisible();

    await page.goto(activationLink);
    await expect(page.getByText(/invalid, expired, or already used/i)).toBeVisible();
    await page.goto(activationLink.replace("/demo-freight/", "/wrong-company/"));
    await expect(page.getByText(/invalid, expired, or already used/i)).toBeVisible();

    const portalContext = await browser.newContext();
    const portalPage = await portalContext.newPage();
    await portalPage.goto("/portal/demo-freight/login");
    await waitForHydration(portalPage);
    await portalPage.fill("input#clientCode", clientId);
    await portalPage.fill("input#clientPassword", "Activated123");
    await portalPage.getByRole("button", { name: "Sign in" }).click();
    await expect(portalPage).toHaveURL(/\/portal\/demo-freight/);
    await portalContext.close();
  });

  test("Missing invitation recipients are recorded safely", async ({ page }) => {
    await loginAsCompanyAdmin(page);
    const customerName = generateTestName("No Contact");
    await page.goto("/dashboard/customers");
    await page.fill('input[name="name"]', customerName);
    await page.getByRole("button", { name: "Create customer" }).click();
    const row = page.getByRole("row").filter({ hasText: customerName });
    await row.getByRole("link", { name: "Portal" }).click();
    await page.getByRole("button", { name: "Send Portal Access" }).click();
    await expect(page.getByText("SKIPPED", { exact: true })).toHaveCount(3);
  });

  test("Quotation and invoice expose customer-safe share options", async ({ page }) => {
    await loginAsCompanyAdmin(page);
    await page.goto("/dashboard/quotations");
    await page.getByRole("row").nth(1).getByRole("link", { name: "View" }).click();
    await waitForHydration(page);
    await page.getByRole("button", { name: "Share" }).click();
    await expect(page.getByRole("link", { name: "WhatsApp" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Email" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Copy Link" })).toBeVisible();
    const shareMenu = page.locator("div.absolute").filter({ hasText: "Share client-safe copy" });
    await expect(shareMenu.getByRole("link", { name: "Print", exact: true })).toBeVisible();
    await expect(shareMenu.getByRole("link", { name: "Download PDF", exact: true })).toBeVisible();
    const whatsappHref = await page.getByRole("link", { name: "WhatsApp" }).getAttribute("href");
    const emailHref = await page.getByRole("link", { name: "Email" }).getAttribute("href");
    expect(whatsappHref).toContain("wa.me");
    expect(whatsappHref).toContain("%2Fportal%2F");
    expect(emailHref).toContain("mailto:");
    expect(emailHref).toContain("%2Fportal%2F");
    const preview = (await page.locator("body").innerText()).toLowerCase();
    for (const unsafe of ["vendor cost", "employee assignment", "agent assignment", "internal notes"]) {
      expect(preview).not.toContain(unsafe);
    }

    await page.goto("/dashboard/invoices");
    await page.getByRole("row").nth(1).getByRole("link", { name: "View" }).click();
    await waitForHydration(page);
    await expect(page.getByRole("button", { name: "Share" })).toBeVisible();
  });

  test("Share outbox action creates a pending safe delivery", async ({ page }) => {
    await loginAsCompanyAdmin(page);
    await page.goto("/dashboard/quotations");
    await page.getByRole("row").nth(1).getByRole("link", { name: "View" }).click();
    const quoteNo = await page.locator("h1").filter({ hasText: /QT-\d{4}-\d+/ }).innerText();
    await page.getByRole("button", { name: "Share" }).click();
    await page.getByRole("button", { name: "Queue Email" }).click();
    await page.goto("/dashboard/notification-deliveries?channel=EMAIL");
    const card = page.locator("section > div.rounded-lg").filter({ hasText: quoteNo }).first();
    await expect(card).toBeVisible();
    const content = (await card.innerText()).toLowerCase();
    for (const unsafe of ["buy cost", "gross profit", "profit margin", "vendor cost", "internal notes"]) {
      expect(content).not.toContain(unsafe);
    }
  });
});
