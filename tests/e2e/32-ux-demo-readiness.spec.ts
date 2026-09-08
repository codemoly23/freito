import { expect, test } from "@playwright/test";
import {
  loginAsClientPortalUser,
  loginAsCompanyAdmin,
  loginAsCompanyUser,
  loginAsPlatformOwner,
  waitForHydration,
} from "./helpers/auth";

test.describe("Phase 17A UX Demo Readiness", () => {
  test("Sidebar navigation key groups and labels render for company admin", async ({ page }) => {
    await loginAsCompanyAdmin(page);
    await waitForHydration(page);

    // Check nav group labels
    await expect(page.getByText("Operations", { exact: true }).first()).toBeVisible();
    await expect(page.getByText("Sales", { exact: true }).first()).toBeVisible();
    await expect(page.getByText("Finance", { exact: true }).first()).toBeVisible();
    await expect(page.getByText("Reports", { exact: true }).first()).toBeVisible();
    await expect(page.getByText("Admin / Settings", { exact: true }).first()).toBeVisible();

    // Check key nav item labels
    await expect(page.getByRole("link", { name: "Shipments / Job Files", exact: true })).toBeVisible();
    await expect(page.getByRole("link", { name: "Shipment Requests", exact: true })).toBeVisible();
    await expect(page.getByRole("link", { name: "Report Center", exact: true })).toBeVisible();
    await expect(page.getByRole("link", { name: "Invoices", exact: true })).toBeVisible();
    await expect(page.getByRole("link", { name: "Vendor Bills", exact: true })).toBeVisible();
    await expect(page.getByRole("link", { name: "Quotations", exact: true })).toBeVisible();
    await expect(page.getByRole("link", { name: "Customers", exact: true })).toBeVisible();
  });

  test("Dashboard page context header renders with business-friendly title", async ({ page }) => {
    await loginAsCompanyAdmin(page);
    await waitForHydration(page);

    // The dashboard should show the Control Tower badge and business title
    await expect(page.getByText("Control Tower").first()).toBeVisible({ timeout: 30000 });
    await expect(page.getByRole("heading", { name: "Today's Operational Control Center" })).toBeVisible({ timeout: 30000 });
    await expect(page.getByText("Monitor shipments, documents, delivery, finance closeout, and reports from one place.")).toBeVisible();

    // KPI sections still present
    await expect(page.getByRole("heading", { name: "Quick Actions" })).toBeVisible({ timeout: 30000 });
    await expect(page.getByRole("heading", { name: "Main KPI Overview" })).toBeVisible({ timeout: 30000 });
    await expect(page.getByRole("heading", { name: "Operational Health" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Sales and Request Flow" })).toBeVisible();
  });

  test("Dashboard quick actions point to existing safe routes", async ({ page }) => {
    await loginAsCompanyAdmin(page);
    await waitForHydration(page);

    await expect(page.getByRole("link", { name: "New Shipment Request", exact: true })).toHaveAttribute("href", "/dashboard/shipment-requests/new");
    await expect(page.getByRole("link", { name: "New Shipment Job", exact: true })).toHaveAttribute("href", "/dashboard/shipments/new");
    await expect(page.getByRole("link", { name: "New Quotation", exact: true })).toHaveAttribute("href", "/dashboard/quotations/new");
    await expect(page.getByRole("link", { name: "View Report Center", exact: true })).toHaveAttribute("href", "/dashboard/reports");
    await expect(page.getByRole("link", { name: "View Financial Reports", exact: true })).toHaveAttribute("href", "/dashboard/reports/financial");
  });

  test("Dashboard operational helper text renders for demo context", async ({ page }) => {
    await loginAsCompanyAdmin(page);
    await waitForHydration(page);

    await expect(page.getByText("Jobs that still need required shipping or client documents.").first()).toBeVisible();
    await expect(page.getByText("Shipments that may need operational follow-up.").first()).toBeVisible();
    await expect(page.getByText("Delivered jobs waiting for finance closeout.")).toBeVisible();
    await expect(page.getByText("Pending Requests", { exact: true })).toBeVisible();
    await expect(page.getByText("Quotations Waiting", { exact: true })).toBeVisible();
    await expect(page.getByText("Accepted Quotes", { exact: true })).toBeVisible();
    await expect(page.getByText("Converted to Job Files", { exact: true })).toBeVisible();
  });

  test("Report tables show safe empty state text for filters with no records", async ({ page }) => {
    await loginAsCompanyAdmin(page);
    await page.goto("/dashboard/reports/operations?from=2099-01-01&to=2099-01-31");
    await waitForHydration(page);

    await expect(page.getByRole("heading", { name: "Operations Report" })).toBeVisible();
    await expect(page.getByText("No shipment records found for the selected filters.")).toBeVisible();
    await expect(page.getByText("Try changing the date range or clearing optional filters.").first()).toBeVisible();
  });

  test("Reports page header renders with Report Center badge", async ({ page }) => {
    await loginAsCompanyAdmin(page);
    await page.goto("/dashboard/reports");
    await waitForHydration(page);

    await expect(page.getByRole("heading", { name: "Reports & Analytics" })).toBeVisible();
    await expect(page.getByText("Report Center").first()).toBeVisible();
    // Business-friendly description visible
    await expect(page.getByText(/Operational, financial, and document insight/i)).toBeVisible();
  });

  test("Operations report header renders with business-friendly label", async ({ page }) => {
    await loginAsCompanyAdmin(page);
    await page.goto("/dashboard/reports/operations");
    await waitForHydration(page);

    await expect(page.getByRole("heading", { name: "Operations Report" })).toBeVisible({ timeout: 30000 });
    await expect(page.getByText("Shipment workload, delay signals, service scope, and finance close readiness.")).toBeVisible({ timeout: 30000 });
    await expect(page.getByRole("heading", { name: "Filter this report" })).toBeVisible();
    // Back link should say Report Center
    await expect(page.getByRole("link", { name: /Report Center/i }).first()).toBeVisible({ timeout: 15000 });
  });

  test("Document report header renders with business-friendly label", async ({ page }) => {
    await loginAsCompanyAdmin(page);
    await page.goto("/dashboard/reports/documents");
    await waitForHydration(page);

    await expect(page.getByRole("heading", { name: "Document Report" })).toBeVisible();
    await expect(page.getByText("Missing, verified, rejected, and client-visible freight documents.")).toBeVisible();
    await expect(page.getByRole("columnheader", { name: "Visible to Client" }).first()).toBeVisible();
  });

  test("Workflow / Delivery report header renders with updated label", async ({ page }) => {
    await loginAsCompanyAdmin(page);
    await page.goto("/dashboard/reports/workflow");
    await waitForHydration(page);

    await expect(page.getByRole("heading", { name: "Workflow / Delivery Report" })).toBeVisible();
    await expect(page.getByText("Delivery order, gate pass, cargo release, POD, and job closeout progress.")).toBeVisible();
    await expect(page.getByRole("columnheader", { name: "POD" })).toBeVisible();
  });

  test("Financial report header renders with business-friendly label", async ({ page }) => {
    await loginAsCompanyUser(page, "accounts@freightcontrol.com");
    await page.goto("/dashboard/reports/financial");
    await waitForHydration(page);

    await expect(page.getByRole("heading", { name: "Financial Report" })).toBeVisible();
    await expect(page.getByText("Receivable, payable, final profit, and finance closeout overview.")).toBeVisible();
  });

  test("Financial report remains permission-gated for non-finance users", async ({ page }) => {
    await loginAsCompanyUser(page, "sales@freightcontrol.com");
    await page.goto("/dashboard/reports/financial");

    await expect(page).toHaveURL(/\/dashboard\/reports\?access=denied/);
    await expect(page.getByText("Your role does not have access")).toBeVisible();
    // Ensure no sensitive finance terms leak through
    await expect(page.locator("body")).not.toContainText(/Final Gross Profit|Pending Payable|Total Buy|Vendor Bill No/i);
  });

  test("Non-finance user dashboard shows Finance KPI gating message without exposing sensitive data", async ({ page }) => {
    await loginAsCompanyUser(page, "sales@freightcontrol.com");
    await waitForHydration(page);

    // Finance section gating message visible
    await expect(page.getByRole("heading", { name: "Finance KPI Section" })).toBeVisible();
    await expect(page.getByText(/Financial KPIs are available to users with financial report permission/i)).toBeVisible();
    await expect(page.getByRole("link", { name: "View Financial Reports", exact: true })).toHaveCount(0);

    // Sensitive finance metrics NOT visible
    await expect(page.getByText("Monthly Revenue", { exact: true })).toHaveCount(0);
    await expect(page.getByText("Monthly Gross Profit", { exact: true })).toHaveCount(0);
    await expect(page.getByText("Pending Payable", { exact: true })).toHaveCount(0);
    await expect(page.getByText("Loss-making Jobs", { exact: true })).toHaveCount(0);
  });

  test("Portal user cannot access dashboard and report UX routes", async ({ browser }) => {
    const portalContext = await browser.newContext();
    const portalPage = await portalContext.newPage();

    try {
      await loginAsClientPortalUser(portalPage, "demo-freight");

      for (const route of [
        "/dashboard",
        "/dashboard/reports",
        "/dashboard/reports/operations",
        "/dashboard/reports/financial",
        "/dashboard/reports/workflow",
      ]) {
        await portalPage.goto(route);
        await expect(portalPage).toHaveURL(/\/login\?error=wrong-portal/);
      }
    } finally {
      await portalContext.close();
    }
  });

  test("Platform user cannot access company dashboard and report UX routes", async ({ browser }) => {
    const platformContext = await browser.newContext();
    const platformPage = await platformContext.newPage();

    try {
      await loginAsPlatformOwner(platformPage);

      for (const route of [
        "/dashboard",
        "/dashboard/reports",
        "/dashboard/reports/operations",
        "/dashboard/reports/financial",
      ]) {
        await platformPage.goto(route);
        await expect(platformPage).toHaveURL(/\/login\?error=wrong-portal/);
      }
    } finally {
      await platformContext.close();
    }
  });

  test("Existing report routes still work for company admin after UX changes", async ({ page }) => {
    await loginAsCompanyAdmin(page);

    const routes = [
      { url: "/dashboard/reports", heading: "Reports & Analytics" },
      { url: "/dashboard/reports/operations", heading: "Operations Report" },
      { url: "/dashboard/reports/documents", heading: "Document Report" },
      { url: "/dashboard/reports/workflow", heading: "Workflow / Delivery Report" },
      { url: "/dashboard/reports/quotations", heading: "Quotation & Sales Report" },
      { url: "/dashboard/reports/requests", heading: "Shipment Request Report" },
    ] as const;

    for (const { url, heading } of routes) {
      await page.goto(url);
      await waitForHydration(page);
      await expect(page.getByRole("heading", { name: heading })).toBeVisible();
    }
  });
});
