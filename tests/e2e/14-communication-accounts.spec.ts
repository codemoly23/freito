import { expect, test } from "@playwright/test";
import {
  createCompanyAdminSession,
  createPlatformSession,
  createPortalClientSession,
  loginAsCompanyAdmin,
  loginAsCompanyUser,
  waitForHydration,
} from "./helpers/auth";
import { generateTestName } from "./helpers/test-data";

async function createDryRunAccounts(page: import("@playwright/test").Page, suffix: string) {
  const emailName = `QA SMTP ${suffix}`;
  const whatsappName = `QA WhatsApp ${suffix}`;
  const smtpSecret = `smtp-secret-${suffix}`;
  const whatsappSecret = `whatsapp-token-${suffix}`;

  await page.goto("/dashboard/communication-accounts/new/email");
  await page.fill('input[name="displayName"]', emailName);
  await page.fill('input[name="host"]', "smtp.example.test");
  await page.fill('input[name="port"]', "587");
  await page.fill('input[name="username"]', `mailer-${suffix}`);
  await page.fill('input[name="password"]', smtpSecret);
  await page.fill('input[name="fromEmail"]', `qa-${suffix.toLowerCase()}@example.test`);
  await page.fill('input[name="fromName"]', "Freight Control QA");
  await page.getByRole("button", { name: "Save SMTP account" }).click();
  await expect(page).toHaveURL(/\/dashboard\/communication-accounts$/);
  await expect(page.getByText(emailName, { exact: true })).toBeVisible();

  await page.goto("/dashboard/communication-accounts/new/whatsapp-cloud");
  await page.fill('input[name="displayName"]', whatsappName);
  await page.fill('input[name="phoneNumberId"]', `phone-${suffix}`);
  await page.fill('input[name="businessAccountId"]', `business-${suffix}`);
  await page.fill('input[name="senderPhone"]', "+8801700000002");
  await page.fill('input[name="accessToken"]', whatsappSecret);
  await page.getByRole("button", { name: "Save WhatsApp Cloud account" }).click();
  await expect(page).toHaveURL(/\/dashboard\/communication-accounts$/);
  await expect(page.getByText(whatsappName, { exact: true })).toBeVisible();

  const pageSource = await page.content();
  expect(pageSource).not.toContain(smtpSecret);
  expect(pageSource).not.toContain(whatsappSecret);
  return { emailName, whatsappName };
}

test.describe("Phase 8C Communication Accounts and Manual Delivery", () => {
  test("Company Admin can open account list and provider forms while QR is disabled", async ({ page }) => {
    await loginAsCompanyAdmin(page);
    await page.goto("/dashboard/communication-accounts");
    await expect(page.getByRole("heading", { name: "Communication Accounts" })).toBeVisible();
    await page.getByRole("link", { name: "Add Email SMTP" }).click();
    await expect(page.getByRole("heading", { name: "Add Email SMTP Account" })).toBeVisible();
    await page.goto("/dashboard/communication-accounts/new/whatsapp-cloud");
    await expect(page.getByRole("heading", { name: "Add WhatsApp Cloud API Account" })).toBeVisible();

    await page.goto("/dashboard/communication-accounts");
    await expect(page.getByRole("link", { name: "Connect WhatsApp by QR" })).toHaveCount(0);
    await page.goto("/dashboard/communication-accounts/new/whatsapp-qr");
    await expect(page.getByText("QR connector disabled", { exact: true })).toBeVisible();
  });

  test("Dry-run accounts save without exposing submitted secrets", async ({ page }) => {
    await loginAsCompanyAdmin(page);
    await createDryRunAccounts(page, generateTestName("ACCOUNT"));
    await expect(page.getByText("Dry-run metadata only").first()).toBeVisible();
  });

  test("Dry-run email and WhatsApp sends work from the delivery outbox", async ({ browser }) => {
    test.setTimeout(90_000);
    const portal = await createPortalClientSession(browser, "demo-freight");
    const admin = await createCompanyAdminSession(browser);
    const suffix = generateTestName("SEND");
    const requestRef = generateTestName("COMM");
    try {
      const accounts = await createDryRunAccounts(admin.page, suffix);
      await portal.page.goto("/portal/demo-freight/requests/new");
      await waitForHydration(portal.page);
      await portal.page.selectOption('select[name="shipmentType"]', "IMPORT");
      await portal.page.selectOption('select[name="transportMode"]', "SEA");
      await portal.page.selectOption('select[name="serviceScope"]', "PORT_TO_PORT");
      await portal.page.fill('input[name="originCountry"]', "China");
      await portal.page.fill('input[name="originPort"]', "Shanghai");
      await portal.page.fill('input[name="destinationCountry"]', "Bangladesh");
      await portal.page.fill('input[name="destinationPort"]', "Chattogram");
      await portal.page.fill('textarea[name="cargoDescription"]', "Phase 8C customer-safe cargo");
      await portal.page.fill('input[name="customerReference"]', requestRef);
      await portal.page.getByRole("button", { name: "Submit shipment request" }).click();
      await expect(portal.page.getByText(/submitted/i)).toBeVisible();
      await portal.page.goto("/portal/demo-freight/requests");
      const requestNo = await portal.page.locator("a.block").first().locator("p.font-medium").innerText();

      await admin.page.goto("/dashboard/shipment-requests");
      await admin.page.getByRole("row").filter({ hasText: requestNo }).getByRole("link", { name: "View" }).click();
      await admin.page.getByRole("button", { name: "Create quotation", exact: true }).click();
      const success = admin.page.getByText(/Quotation QT-\d{4}-\d+ created\./);
      await expect(success).toBeVisible();
      const quoteNo = (await success.innerText()).match(/QT-\d{4}-\d+/)?.[0];
      expect(quoteNo).toBeTruthy();

      await admin.page.goto("/dashboard/notification-deliveries?status=PENDING");
      const emailCard = admin.page.locator("section > div.rounded-lg").filter({ hasText: quoteNo! }).filter({ hasText: "EMAIL" }).first();
      await expect(emailCard).toBeVisible();
      await emailCard.getByRole("combobox").selectOption({ label: accounts.emailName });
      await Promise.all([
        admin.page.waitForResponse((response) => response.request().method() === "POST" && response.url().includes("/dashboard/notification-deliveries")),
        emailCard.getByRole("button", { name: "Send Now" }).click(),
      ]);
      await expect(emailCard).toHaveCount(0);

      const whatsappCard = admin.page.locator("section > div.rounded-lg").filter({ hasText: quoteNo! }).filter({ hasText: "WHATSAPP" }).first();
      await expect(whatsappCard).toBeVisible();
      await whatsappCard.getByRole("combobox").selectOption({ label: accounts.whatsappName });
      await Promise.all([
        admin.page.waitForResponse((response) => response.request().method() === "POST" && response.url().includes("/dashboard/notification-deliveries")),
        whatsappCard.getByRole("button", { name: "Send Now" }).click(),
      ]);
      await expect(whatsappCard).toHaveCount(0);

      await admin.page.goto("/dashboard/notification-deliveries?status=SENT");
      const sentEmail = admin.page.locator("section > div.rounded-lg").filter({ hasText: quoteNo! }).filter({ hasText: accounts.emailName }).first();
      const sentWhatsApp = admin.page.locator("section > div.rounded-lg").filter({ hasText: quoteNo! }).filter({ hasText: accounts.whatsappName }).first();
      await expect(sentEmail).toBeVisible();
      await expect(sentWhatsApp).toBeVisible();
      const customerSafeSource = `${await sentEmail.innerText()} ${await sentWhatsApp.innerText()}`.toLowerCase();
      for (const unsafe of ["internal cost", "gross profit", "profit margin", "vendor cost", "employee assignment", "agent assignment", "internal notes"]) {
        expect(customerSafeSource).not.toContain(unsafe);
      }
    } finally {
      await Promise.allSettled([portal.context.close(), admin.context.close()]);
    }
  });

  test("Portal and platform users cannot access communication accounts", async ({ browser }) => {
    const portal = await createPortalClientSession(browser, "demo-freight");
    const platform = await createPlatformSession(browser);
    try {
      await portal.page.goto("/dashboard/communication-accounts");
      await expect(portal.page).not.toHaveURL(/\/dashboard\/communication-accounts$/);
      await platform.page.goto("/dashboard/communication-accounts");
      await expect(platform.page).not.toHaveURL(/\/dashboard\/communication-accounts$/);
    } finally {
      await Promise.allSettled([portal.context.close(), platform.context.close()]);
    }
  });

  test("View/send roles cannot manage communication accounts", async ({ page }) => {
    await loginAsCompanyUser(page, "accounts@freightcontrol.com");
    await page.goto("/dashboard/communication-accounts");
    await expect(page.getByRole("heading", { name: "Communication Accounts" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Add Email SMTP" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Set default" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Disable" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Disconnect" })).toHaveCount(0);
    await page.goto("/dashboard/communication-accounts/new/email");
    await expect(page).not.toHaveURL(/\/dashboard\/communication-accounts\/new\/email$/);
  });
});
