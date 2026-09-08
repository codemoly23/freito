import { expect, test } from "@playwright/test";
import {
  loginAsClientPortalUser,
  loginAsCompanyUser,
  loginAsPlatformOwner,
  waitForHydration,
} from "./helpers/auth";

test.describe("Phase 16D Finance and Profit Report Tables", () => {
  test("Financial report renders summary cards, profit, closeout, receivable, and payable tables", async ({ page }) => {
    await loginAsCompanyUser(page, "accounts@freightcontrol.com");
    await page.goto("/dashboard/reports/financial");
    await waitForHydration(page);

    await expect(page.getByRole("heading", { name: "Financial Report" })).toBeVisible();
    await expect(page.getByText("Receivable, payable, final profit, and finance closeout overview.")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Filter this report" })).toBeVisible();
    await expect(page.getByRole("paragraph").filter({ hasText: /^Total Sell$/ })).toBeVisible();
    await expect(page.getByRole("paragraph").filter({ hasText: /^Total Buy$/ })).toBeVisible();
    await expect(page.getByRole("paragraph").filter({ hasText: /^Gross profit$/ })).toBeVisible();
    await expect(page.getByRole("paragraph").filter({ hasText: /^Final Gross Profit$/ })).toBeVisible();
    await expect(page.getByRole("paragraph").filter({ hasText: /^Pending Receivable$/ })).toBeVisible();
    await expect(page.getByRole("paragraph").filter({ hasText: /^Pending Payable$/ })).toBeVisible();
    await expect(page.getByRole("paragraph").filter({ hasText: /^Finance Locked Jobs$/ })).toBeVisible();

    await expect(page.getByRole("heading", { name: "Job-wise profit report" })).toBeVisible();
    await expect(page.getByRole("columnheader", { name: "Final Gross Profit" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Finance closeout report" })).toBeVisible();
    await expect(page.getByRole("columnheader", { name: "Receivable Outstanding" })).toBeVisible();
    await expect(page.getByRole("columnheader", { name: "Open Record" }).first()).toBeVisible();
    await expect(page.getByRole("heading", { name: "Receivable aging report" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Payable aging report" })).toBeVisible();
    await expect(page.getByLabel("Finance close status")).toBeVisible();
    await expect(page.getByLabel("Aging bucket")).toBeVisible();
    await expect(page.getByLabel("Profit status")).toBeVisible();
  });

  test("Non-finance user is denied financial report and does not see protected finance terms", async ({ page }) => {
    await loginAsCompanyUser(page, "sales@freightcontrol.com");
    await page.goto("/dashboard/reports/financial");

    await expect(page).toHaveURL(/\/dashboard\/reports\?access=denied/);
    await expect(page.getByText("Your role does not have access")).toBeVisible();
    await expect(page.locator("body")).not.toContainText(/Final Gross Profit|Pending Payable|Current Buy|Vendor Bill No/i);
  });

  test("Portal and platform sessions cannot access financial report route", async ({ browser }) => {
    const portalContext = await browser.newContext();
    const portalPage = await portalContext.newPage();
    const platformContext = await browser.newContext();
    const platformPage = await platformContext.newPage();

    try {
      await loginAsClientPortalUser(portalPage, "demo-freight");
      await portalPage.goto("/dashboard/reports/financial");
      await expect(portalPage).toHaveURL(/\/login\?error=wrong-portal/);

      await loginAsPlatformOwner(platformPage);
      await platformPage.goto("/dashboard/reports/financial");
      await expect(platformPage).toHaveURL(/\/login\?error=wrong-portal/);
    } finally {
      await portalContext.close();
      await platformContext.close();
    }
  });
});
