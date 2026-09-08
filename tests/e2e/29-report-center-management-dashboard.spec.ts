import { expect, test } from "@playwright/test";
import {
  loginAsClientPortalUser,
  loginAsCompanyAdmin,
  loginAsCompanyUser,
  loginAsPlatformOwner,
} from "./helpers/auth";

test.describe("Phase 16 Report Center and Management Dashboard", () => {
  test("Company Admin sees dashboard KPI overview, operational health, finance KPIs, and report center", async ({ page }) => {
    await loginAsCompanyAdmin(page);

    await expect(page.getByRole("heading", { name: "Today's Operational Control Center" })).toBeVisible();
    await expect(page.getByText("Monitor shipments, documents, delivery, finance closeout, and reports from one place.")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Quick Actions" })).toBeVisible();
    await expect(page.getByRole("link", { name: "New Shipment Request", exact: true })).toHaveAttribute("href", "/dashboard/shipment-requests/new");
    await expect(page.getByRole("link", { name: "New Shipment Job", exact: true })).toHaveAttribute("href", "/dashboard/shipments/new");
    await expect(page.getByRole("link", { name: "New Quotation", exact: true })).toHaveAttribute("href", "/dashboard/quotations/new");
    await expect(page.getByRole("link", { name: "View Report Center", exact: true })).toHaveAttribute("href", "/dashboard/reports");
    await expect(page.getByRole("link", { name: "View Financial Reports", exact: true })).toHaveAttribute("href", "/dashboard/reports/financial");

    await expect(page.getByRole("heading", { name: "Main KPI Overview" })).toBeVisible();
    await expect(page.getByText("Total Shipments", { exact: true })).toBeVisible();
    await expect(page.getByText("Active Shipments", { exact: true })).toBeVisible();
    await expect(page.getByText("Open Jobs", { exact: true })).toBeVisible();
    await expect(page.getByText("Closed Jobs", { exact: true })).toBeVisible();

    await expect(page.getByRole("heading", { name: "Operational Health" })).toBeVisible();
    await expect(page.getByText("Delayed Jobs", { exact: true }).first()).toBeVisible();
    await expect(page.getByText("Missing Documents", { exact: true }).first()).toBeVisible();
    await expect(page.getByText("Delivery/POD Pending", { exact: true })).toBeVisible();
    await expect(page.getByText("Finance Close Pending", { exact: true }).first()).toBeVisible();
    await expect(page.getByText("Delivered but Finance Open", { exact: true }).first()).toBeVisible();
    await expect(page.getByText("Jobs that still need required shipping or client documents.").first()).toBeVisible();
    await expect(page.getByText("Shipments that may need operational follow-up.").first()).toBeVisible();
    await expect(page.getByText("Delivered jobs waiting for finance closeout.")).toBeVisible();

    await expect(page.getByRole("heading", { name: "Finance KPI Section" })).toBeVisible();
    await expect(page.getByText("Monthly Revenue", { exact: true })).toBeVisible();
    await expect(page.getByText("Monthly Gross Profit", { exact: true })).toBeVisible();
    await expect(page.getByText("Pending Receivable", { exact: true })).toBeVisible();
    await expect(page.getByText("Pending Payable", { exact: true })).toBeVisible();
    await expect(page.getByText("Customer payments still outstanding.")).toBeVisible();
    await expect(page.getByText("Vendor bills still outstanding.")).toBeVisible();
    await expect(page.getByText("Finance Locked Jobs", { exact: true })).toBeVisible();
    await expect(page.getByText("Low-margin Jobs", { exact: true })).toBeVisible();
    await expect(page.getByText("Loss-making Jobs", { exact: true })).toBeVisible();
    await expect(page.getByRole("link", { name: "Open report" }).first()).toBeVisible();

    await page.goto("/dashboard/reports");
    await expect(page.getByRole("heading", { name: "Reports & Analytics" })).toBeVisible();
  });

  test("Non-finance reports user does not see protected profit metrics", async ({ page }) => {
    await loginAsCompanyUser(page, "sales@freightcontrol.com");

    await expect(page.getByRole("heading", { name: "Main KPI Overview" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Quick Actions" })).toBeVisible();
    await expect(page.getByRole("link", { name: "View Report Center", exact: true })).toBeVisible();
    await expect(page.getByRole("link", { name: "View Financial Reports", exact: true })).toHaveCount(0);
    await expect(page.getByText("Finance Close Pending", { exact: true }).first()).toBeVisible();
    await expect(page.getByRole("heading", { name: "Finance KPI Section" })).toBeVisible();
    await expect(page.getByText("Financial KPIs are available to users with financial report permission.")).toBeVisible();
    await expect(page.getByText("Monthly Revenue", { exact: true })).toHaveCount(0);
    await expect(page.getByText("Monthly Gross Profit", { exact: true })).toHaveCount(0);
    await expect(page.getByText("Pending Payable", { exact: true })).toHaveCount(0);
    await expect(page.getByText("Low-margin Jobs", { exact: true })).toHaveCount(0);
    await expect(page.getByText("Loss-making Jobs", { exact: true })).toHaveCount(0);
  });

  test("Portal and platform sessions remain blocked from company dashboard and report routes", async ({ browser }) => {
    const portalContext = await browser.newContext();
    const portalPage = await portalContext.newPage();
    const platformContext = await browser.newContext();
    const platformPage = await platformContext.newPage();

    try {
      await loginAsClientPortalUser(portalPage, "demo-freight");
      await portalPage.goto("/dashboard");
      await expect(portalPage).toHaveURL(/\/login\?error=wrong-portal/);
      await portalPage.goto("/dashboard/reports");
      await expect(portalPage).toHaveURL(/\/login\?error=wrong-portal/);

      await loginAsPlatformOwner(platformPage);
      await platformPage.goto("/dashboard");
      await expect(platformPage).toHaveURL(/\/login\?error=wrong-portal/);
      await platformPage.goto("/dashboard/reports");
      await expect(platformPage).toHaveURL(/\/login\?error=wrong-portal/);
    } finally {
      await portalContext.close();
      await platformContext.close();
    }
  });
});
