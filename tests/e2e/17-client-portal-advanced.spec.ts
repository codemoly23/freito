import { expect, test } from "@playwright/test";
import {
  createPlatformSession,
  createPortalClientSession,
  loginAsCompanyAdmin,
  loginAsClientPortalUser,
} from "./helpers/auth";
import { generateTestName } from "./helpers/test-data";

const unsafeTerms = ["buy cost", "gross profit", "profit margin", "vendor cost", "employee assignment", "agent assignment", "handler type", "internal notes"];

async function expectCustomerSafe(text: string) {
  const source = text.toLowerCase();
  for (const term of unsafeTerms) expect(source).not.toContain(term);
}

test.describe("Phase 8G Advanced Client Portal", () => {
  test("Company Admin can upload tenant branding and portal dashboard shows scoped KPIs", async ({ page, browser }) => {
    await loginAsCompanyAdmin(page);
    await page.goto("/dashboard/settings/branding");
    await expect(page.getByRole("heading", { name: "Company Branding" })).toBeVisible();
    await page.locator('input[name="logo"]').setInputFiles({
      name: "qa-logo.png",
      mimeType: "image/png",
      buffer: Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=", "base64"),
    });
    await page.getByRole("button", { name: "Upload logo" }).click();
    await expect(page.getByText("Company logo updated.")).toBeVisible();
    await expect(page.getByAltText("Current company logo")).toBeVisible();

    const portal = await createPortalClientSession(browser, "demo-freight");
    try {
      await portal.page.goto("/portal/demo-freight");
      for (const title of ["Active shipments", "Pending quotations", "Open invoices", "Missing documents", "Unread notifications"]) {
        await expect(portal.page.locator("p.uppercase").filter({ hasText: title })).toBeVisible();
      }
      await expect(portal.page.getByAltText(/logo/i)).toBeVisible();
      await expectCustomerSafe(await portal.page.locator("body").innerText());
    } finally {
      await portal.context.close();
    }
  });

  test("Portal quotation detail, print, and PDF are client-safe", async ({ page }) => {
    await loginAsClientPortalUser(page, "demo-freight");
    await page.goto("/portal/demo-freight/requests");
    await page.locator("a.block").filter({ hasText: /QT-\d{4}-\d+/ }).first().click();
    await page.getByRole("link", { name: "Open quotation" }).click();
    await expect(page.getByRole("link", { name: "Print", exact: true })).toBeVisible();
    const pdfUrl = await page.getByRole("link", { name: "Download PDF", exact: true }).getAttribute("href");
    await expectCustomerSafe(await page.locator("body").innerText());

    await page.getByRole("link", { name: "Print", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Quotation", exact: true })).toBeVisible();
    await expectCustomerSafe(await page.locator(".print-document").innerText());
    const pdf = await page.request.get(pdfUrl!);
    expect(pdf.ok()).toBeTruthy();
    expect(pdf.headers()["content-type"]).toContain("application/pdf");
    expect((await pdf.body()).subarray(0, 4).toString()).toBe("%PDF");
  });

  test("Portal invoice list, detail, print, and PDF are client-safe", async ({ page }) => {
    await loginAsClientPortalUser(page, "demo-freight");
    await page.goto("/portal/demo-freight/invoices");
    await expect(page.getByRole("heading", { name: "Invoices", exact: true })).toBeVisible();
    await page.locator('a[href*="/invoices/"]').first().click();
    const pdfUrl = await page.getByRole("link", { name: "Download PDF", exact: true }).getAttribute("href");
    await expectCustomerSafe(await page.locator("body").innerText());
    await page.getByRole("link", { name: "Print", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Invoice", exact: true })).toBeVisible();
    await expectCustomerSafe(await page.locator(".print-document").innerText());
    const pdf = await page.request.get(pdfUrl!);
    expect(pdf.ok()).toBeTruthy();
    expect(pdf.headers()["content-type"]).toContain("application/pdf");
  });

  test("Portal shipment tracking exposes safe milestones and validates document uploads", async ({ page }) => {
    await loginAsClientPortalUser(page, "demo-freight");
    await page.goto("/portal/demo-freight/shipments");
    await page.locator('a[href*="/shipments/"]').first().click();
    await expect(page.getByRole("heading", { name: "Shipment milestones" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Required document checklist" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Print Summary" })).toBeVisible();
    await expectCustomerSafe(await page.locator("body").innerText());

    const uploadRow = page.locator('div.grid:has(input[type="file"])').first();
    await uploadRow.locator('input[type="file"]').setInputFiles({ name: "bad.txt", mimeType: "text/plain", buffer: Buffer.from("not allowed") });
    await page.getByRole("button", { name: /Upload Selected/ }).click();
    await expect(page.getByText(/Unsupported file/)).toBeVisible();

    await uploadRow.locator('input[type="file"]').setInputFiles({ name: "client-document.pdf", mimeType: "application/pdf", buffer: Buffer.from("%PDF-1.4\n% portal QA\n") });
    await page.getByRole("button", { name: /Upload Selected/ }).click();
    await expect(page.getByText(/uploaded for review/)).toBeVisible();
    await expect(page.getByText("UPLOADED", { exact: true }).first()).toBeVisible();
  });

  test("Portal ownership and scope prevent cross-customer, dashboard, and platform access", async ({ browser }) => {
    const admin = await browser.newContext();
    const adminPage = await admin.newPage();
    const otherCustomer = generateTestName("Portal Isolation Customer");
    await loginAsCompanyAdmin(adminPage);
    await adminPage.goto("/dashboard/customers");
    await adminPage.fill('input[name="name"]', otherCustomer);
    await adminPage.getByRole("button", { name: "Create customer" }).click();
    await expect(adminPage.getByRole("row").filter({ hasText: otherCustomer })).toBeVisible();
    await adminPage.goto("/dashboard/invoices/new");
    await adminPage.selectOption('select[name="customerId"]', { label: otherCustomer });
    await adminPage.fill('input[name="invoiceDate"]', new Date().toISOString().slice(0, 10));
    await adminPage.fill('input[name="lineDescription"]', "Customer isolation invoice");
    await adminPage.fill('input[name="lineQuantity"]', "1");
    await adminPage.fill('input[name="lineUnitPrice"]', "100");
    await adminPage.getByRole("button", { name: "Create invoice" }).click();
    const created = adminPage.getByText(/Invoice INV-\d{4}-\d+ created\./);
    const invoiceNo = (await created.innerText()).match(/INV-\d{4}-\d+/)?.[0];
    await adminPage.goto("/dashboard/invoices");
    const dashboardHref = await adminPage.getByRole("row").filter({ hasText: invoiceNo! }).getByRole("link", { name: "View" }).getAttribute("href");
    const invoiceId = dashboardHref!.split("/").pop()!;

    const portal = await createPortalClientSession(browser, "demo-freight");
    const platform = await createPlatformSession(browser);
    try {
      await portal.page.goto("/portal/demo-freight/invoices");
      const ownInvoiceHref = await portal.page.locator('a[href*="/invoices/"]').first().getAttribute("href");
      await portal.page.goto(`/portal/demo-freight/invoices/${invoiceId}`);
      await expect(portal.page.getByText("This page could not be found.")).toBeVisible();

      await adminPage.goto("/portal/demo-freight/invoices");
      await expect(adminPage).not.toHaveURL(/\/portal\/demo-freight\/invoices$/);
      await platform.page.goto("/portal/demo-freight/invoices");
      await expect(platform.page).not.toHaveURL(/\/portal\/demo-freight\/invoices$/);

      if (ownInvoiceHref) {
        const printPath = `${ownInvoiceHref}/print`;
        await platform.page.goto(printPath);
        await expect(platform.page).not.toHaveURL(new RegExp(`${printPath}$`));
      }
    } finally {
      await Promise.allSettled([admin.close(), portal.context.close(), platform.context.close()]);
    }
  });
});
