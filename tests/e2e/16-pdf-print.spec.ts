import { expect, test } from "@playwright/test";
import {
  createPlatformSession,
  createPortalClientSession,
  loginAsCompanyAdmin,
} from "./helpers/auth";

const forbiddenCustomerTerms = [
  "buy cost",
  "gross profit",
  "profit margin",
  "vendor cost",
  "employee assignment",
  "agent assignment",
  "internal notes",
];

async function expectCustomerSafe(pageText: string) {
  const source = pageText.toLowerCase();
  for (const term of forbiddenCustomerTerms) expect(source).not.toContain(term);
}

test.describe("Phase 8F PDF and Print Output", () => {
  test("Quotation offers professional client-safe print and PDF output", async ({ page }) => {
    await loginAsCompanyAdmin(page);
    await page.goto("/dashboard/quotations");
    await page.getByRole("row").nth(1).getByRole("link", { name: "View" }).click();
    await expect(page.getByRole("link", { name: "Print", exact: true })).toBeVisible();
    const pdfLink = page.getByRole("link", { name: "Download PDF", exact: true }).first();
    await expect(pdfLink).toBeVisible();
    const pdfUrl = await pdfLink.getAttribute("href");

    await page.getByRole("link", { name: "Print", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Quotation", exact: true })).toBeVisible();
    await expect(page.getByText("Charges", { exact: true })).toBeVisible();
    await expectCustomerSafe(await page.locator(".print-document").last().innerText());

    const response = await page.request.get(pdfUrl!);
    expect(response.ok()).toBeTruthy();
    expect(response.headers()["content-type"]).toContain("application/pdf");
    expect((await response.body()).subarray(0, 4).toString()).toBe("%PDF");
  });

  test("Invoice offers professional client-safe print and PDF output", async ({ page }) => {
    await loginAsCompanyAdmin(page);
    await page.goto("/dashboard/invoices");
    await page.getByRole("row").nth(1).getByRole("link", { name: "View" }).click();
    await expect(page.getByRole("link", { name: "Print", exact: true })).toBeVisible();
    const pdfLink = page.getByRole("link", { name: "Download PDF", exact: true }).first();
    const pdfUrl = await pdfLink.getAttribute("href");

    await page.getByRole("link", { name: "Print", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Invoice", exact: true })).toBeVisible();
    await expect(page.getByText("Line items", { exact: true })).toBeVisible();
    await expectCustomerSafe(await page.locator(".print-document").last().innerText());

    const response = await page.request.get(pdfUrl!);
    expect(response.ok()).toBeTruthy();
    expect(response.headers()["content-type"]).toContain("application/pdf");
    expect((await response.body()).subarray(0, 4).toString()).toBe("%PDF");
  });

  test("Shipment summary, checklist, and Share modal expose safe print/PDF actions", async ({ page }) => {
    await loginAsCompanyAdmin(page);
    await page.goto("/dashboard/shipments");
    await page.getByRole("row").nth(1).getByRole("link", { name: "View" }).click();
    await expect(page.getByRole("link", { name: "Print Summary" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Download Summary PDF" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Print Checklist" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Download Checklist PDF" })).toBeVisible();

    await page.getByRole("button", { name: "Share" }).click();
    await expect(page.getByRole("link", { name: "Print", exact: true })).toBeVisible();
    await expect(page.getByRole("link", { name: "Download PDF", exact: true })).toBeVisible();

    const summaryPrintUrl = await page.getByRole("link", { name: "Print Summary" }).getAttribute("href");
    const summaryPdfUrl = await page.getByRole("link", { name: "Download Summary PDF" }).getAttribute("href");
    const checklistPrintUrl = await page.getByRole("link", { name: "Print Checklist" }).getAttribute("href");
    const checklistPdfUrl = await page.getByRole("link", { name: "Download Checklist PDF" }).getAttribute("href");

    await page.goto(summaryPrintUrl!);
    await expect(page.getByRole("heading", { name: "Shipment Summary" })).toBeVisible();
    await expectCustomerSafe(await page.locator(".print-document").last().innerText());
    const summaryPdf = await page.request.get(summaryPdfUrl!);
    expect(summaryPdf.headers()["content-type"]).toContain("application/pdf");

    await page.goto(checklistPrintUrl!);
    await expect(page.getByRole("heading", { name: "Document Checklist" })).toBeVisible();
    await expectCustomerSafe(await page.locator(".print-document").last().innerText());
    const checklistPdf = await page.request.get(checklistPdfUrl!);
    expect(checklistPdf.headers()["content-type"]).toContain("application/pdf");
  });

  test("Portal and platform sessions cannot access company print or PDF routes", async ({ browser }) => {
    const portal = await createPortalClientSession(browser, "demo-freight");
    const platform = await createPlatformSession(browser);
    try {
      const printPath = "/dashboard/quotations/not-a-company-record/print";
      const pdfPath = "/api/quotations/not-a-company-record/pdf";
      await portal.page.goto(printPath);
      await expect(portal.page).not.toHaveURL(new RegExp(`${printPath}$`));
      await platform.page.goto(printPath);
      await expect(platform.page).not.toHaveURL(new RegExp(`${printPath}$`));
      const portalStatus = (await portal.page.request.get(pdfPath)).status();
      const platformStatus = (await platform.page.request.get(pdfPath)).status();
      // Accept safe denial statuses (401 or 403) depending on auth surface.
      expect([401, 403]).toContain(portalStatus);
      expect([401, 403]).toContain(platformStatus);
    } finally {
      await Promise.allSettled([portal.context.close(), platform.context.close()]);
    }
  });
});
