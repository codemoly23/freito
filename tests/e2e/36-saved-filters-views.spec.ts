import "dotenv/config";
import { expect, test } from "@playwright/test";
import mariadb from "mariadb";
import { createCompanyAdminSession, loginAsCompanyUser, waitForHydration } from "./helpers/auth";
import { generateTestName } from "./helpers/test-data";

async function createDbConnection() {
  const databaseUrl = new URL(process.env.DATABASE_URL ?? "");
  return mariadb.createConnection({
    host: databaseUrl.hostname,
    port: databaseUrl.port ? Number(databaseUrl.port) : 3306,
    user: decodeURIComponent(databaseUrl.username),
    password: decodeURIComponent(databaseUrl.password),
    database: databaseUrl.pathname.slice(1),
  });
}

async function countSavedViewsNamed(name: string) {
  const connection = await createDbConnection();
  try {
    const rows = await connection.query<{ count: bigint }[]>(
      "SELECT COUNT(*) AS count FROM SavedView WHERE name = ?",
      [name],
    );
    return Number(rows[0].count);
  } finally {
    await connection.end();
  }
}

test.describe("Phase 04 Saved Filters & Views", () => {
  test("save, recall, rename and delete a view on the shipments page", async ({ page }) => {
    test.setTimeout(60_000);
    await loginAsCompanyUser(page, "admin@freightcontrol.com");
    const viewName = generateTestName("Import Jobs");

    await page.goto("/dashboard/shipments?shipmentType=IMPORT");
    await waitForHydration(page);

    await page.getByRole("button", { name: "Save view" }).click();
    await page.getByPlaceholder("View name").fill(viewName);
    await page.getByRole("button", { name: "Save", exact: true }).click();
    await expect(page.getByText("View saved.")).toBeVisible({ timeout: 10_000 });

    // Recall from a bare visit -- the saved filter must bring the URL back.
    await page.goto("/dashboard/shipments");
    await waitForHydration(page);
    await page.getByRole("button", { name: /^Views/ }).click();
    await page.getByRole("button", { name: viewName, exact: true }).click();
    await page.waitForURL(/shipmentType=IMPORT/, { timeout: 10_000 });

    // Rename.
    await page.getByRole("button", { name: /^Views/ }).click();
    await page.getByRole("button", { name: `Rename ${viewName}` }).click();
    const renamed = `${viewName} Renamed`;
    const renameForm = page.locator("form").filter({ has: page.locator(`input[value="${viewName}"]`) });
    await renameForm.getByRole("textbox").fill(renamed);
    await renameForm.getByRole("button", { name: "Save" }).click();
    await expect(page.getByText("View updated.")).toBeVisible({ timeout: 10_000 });

    await page.goto("/dashboard/shipments");
    await waitForHydration(page);
    await page.getByRole("button", { name: /^Views/ }).click();
    await expect(page.getByRole("button", { name: renamed, exact: true })).toBeVisible({ timeout: 10_000 });

    // Delete.
    await page.getByRole("button", { name: `Delete ${renamed}` }).click();
    await page.waitForTimeout(500);
    await page.reload();
    await waitForHydration(page);
    await page.getByRole("button", { name: /^Views/ }).click();
    await expect(page.getByRole("button", { name: renamed, exact: true })).toHaveCount(0);
  });

  test("marking a view default auto-applies it on a bare page visit", async ({ page }) => {
    test.setTimeout(60_000);
    await loginAsCompanyUser(page, "admin@freightcontrol.com");
    const viewName = generateTestName("Default Sea");

    await page.goto("/dashboard/shipments?transportMode=SEA");
    await waitForHydration(page);
    await page.getByRole("button", { name: "Save view" }).click();
    await page.getByPlaceholder("View name").fill(viewName);
    await page.getByLabel("Set as default for this page").check();
    await page.getByRole("button", { name: "Save", exact: true }).click();
    await expect(page.getByText("View saved.")).toBeVisible({ timeout: 10_000 });

    await page.goto("/dashboard/shipments");
    await page.waitForURL(/transportMode=SEA/, { timeout: 10_000 });
  });

  test("saving a second view with a duplicate name is rejected", async ({ page }) => {
    test.setTimeout(60_000);
    await loginAsCompanyUser(page, "admin@freightcontrol.com");
    const viewName = generateTestName("Dup Name");

    async function saveView() {
      await page.getByRole("button", { name: "Save view" }).click();
      await page.getByPlaceholder("View name").fill(viewName);
      await page.getByRole("button", { name: "Save", exact: true }).click();
    }

    await page.goto("/dashboard/quotations?status=SENT");
    await waitForHydration(page);
    await saveView();
    await expect(page.getByText("View saved.")).toBeVisible({ timeout: 10_000 });

    await page.goto("/dashboard/quotations?status=ACCEPTED");
    await waitForHydration(page);
    await saveView();
    await expect(page.getByText(/already have a saved view with this name/i)).toBeVisible({ timeout: 10_000 });

    const count = await countSavedViewsNamed(viewName);
    expect(count).toBe(1);
  });

  test("a saved view is private -- another authorized user cannot see it", async ({ browser }) => {
    test.setTimeout(60_000);
    const admin = await createCompanyAdminSession(browser);
    const docs = await browser.newContext();
    const docsPage = await docs.newPage();
    try {
      const viewName = generateTestName("Admin Only");
      await admin.page.goto("/dashboard/quotations?status=DRAFT");
      await waitForHydration(admin.page);
      await admin.page.getByRole("button", { name: "Save view" }).click();
      await admin.page.getByPlaceholder("View name").fill(viewName);
      await admin.page.getByRole("button", { name: "Save", exact: true }).click();
      await expect(admin.page.getByText("View saved.")).toBeVisible({ timeout: 10_000 });

      await loginAsCompanyUser(docsPage, "docs@freightcontrol.com");
      await docsPage.goto("/dashboard/quotations");
      await waitForHydration(docsPage);
      await docsPage.getByRole("button", { name: /^Views/ }).click();
      await expect(docsPage.getByRole("button", { name: viewName })).toHaveCount(0);
    } finally {
      await Promise.allSettled([admin.context.close(), docs.close()]);
    }
  });

  test("recalling a saved view still respects live branch scope for a branch-restricted user", async ({ page }) => {
    test.setTimeout(60_000);
    await loginAsCompanyUser(page, "operations@freightcontrol.com");
    const viewName = generateTestName("CTG Import");

    await page.goto("/dashboard/shipments?shipmentType=IMPORT");
    await waitForHydration(page);
    await expect(page.getByText("JOB-DEMO-2026-0001", { exact: true })).not.toBeVisible();

    await page.getByRole("button", { name: "Save view" }).click();
    await page.getByPlaceholder("View name").fill(viewName);
    await page.getByRole("button", { name: "Save", exact: true }).click();
    await expect(page.getByText("View saved.")).toBeVisible({ timeout: 10_000 });

    await page.goto("/dashboard/shipments");
    await waitForHydration(page);
    await page.getByRole("button", { name: /^Views/ }).click();
    await page.getByRole("button", { name: viewName, exact: true }).click();
    await page.waitForURL(/shipmentType=IMPORT/, { timeout: 10_000 });

    // The recalled filter matches JOB-DEMO-2026-0001 (IMPORT/SEA), but it lives
    // in Head Office -- branch scope must still exclude it for this user.
    await expect(page.getByText("JOB-DEMO-2026-0001", { exact: true })).not.toBeVisible();
  });

  test("a tampered pageKey is rejected server-side and never persisted", async ({ page }) => {
    test.setTimeout(60_000);
    await loginAsCompanyUser(page, "admin@freightcontrol.com");
    const viewName = generateTestName("Tampered Page");

    await page.goto("/dashboard/shipments?shipmentType=EXPORT");
    await waitForHydration(page);
    await page.getByRole("button", { name: "Save view" }).click();
    await page.getByPlaceholder("View name").fill(viewName);
    await page.locator('input[name="pageKey"]').evaluate((el, value) => {
      (el as HTMLInputElement).value = value;
    }, "not_a_real_page");
    await page.getByRole("button", { name: "Save", exact: true }).click();
    await expect(page.getByText("Unknown page.")).toBeVisible({ timeout: 10_000 });

    const count = await countSavedViewsNamed(viewName);
    expect(count).toBe(0);
  });
});
