import { expect, test } from "@playwright/test";
import { createCompanyAdminSession, loginAsCompanyUser, waitForHydration } from "./helpers/auth";
import { generateTestName } from "./helpers/test-data";

type SearchResult = {
  type: string;
  id: string;
  title: string;
  secondary: string | null;
  href: string;
  branchLabel: string | null;
};

type SearchResponse = { ok: boolean; results: SearchResult[]; query?: string };

async function search(request: import("@playwright/test").APIRequestContext, q: string) {
  const response = await request.get(`/api/search?q=${encodeURIComponent(q)}`);
  const body = (await response.json()) as SearchResponse;
  return { status: response.status(), body };
}

test.describe("Phase 03 Advanced Global Search", () => {
  test("every supported entity type is searchable by its own admin", async ({ browser }) => {
    const admin = await createCompanyAdminSession(browser);
    try {
      const { status, body } = await search(admin.context.request, "DEMO-2026-0001");
      expect(status).toBe(200);
      expect(body.ok).toBe(true);
      expect(body.results.some((r) => r.type === "shipment" && r.title === "JOB-DEMO-2026-0001")).toBe(true);

      const quotation = await search(admin.context.request, "QT-DEMO-2026-0001");
      expect(quotation.body.results.some((r) => r.type === "quotation" && r.title === "QT-DEMO-2026-0001")).toBe(true);

      const invoice = await search(admin.context.request, "INV-DEMO-2026-0001");
      expect(invoice.body.results.some((r) => r.type === "invoice" && r.title === "INV-DEMO-2026-0001")).toBe(true);

      const vendor = await search(admin.context.request, "Blue Horizon");
      expect(vendor.body.results.some((r) => r.type === "vendor" && r.title === "Blue Horizon Ocean Line")).toBe(true);

      const customer = await search(admin.context.request, "Bengal Apparel");
      expect(customer.body.results.some((r) => r.type === "customer" && r.title.includes("Bengal Apparel"))).toBe(true);

      const document = await search(admin.context.request, "Commercial Invoice");
      expect(document.body.results.some((r) => r.type === "document")).toBe(true);

      // Safe-metadata contract: no internal cost/profit or file-path fields ever leave the API.
      const raw = JSON.stringify(body.results) + JSON.stringify(invoice.body.results);
      for (const forbidden of ["grossProfit", "totalBuyAmount", "totalSellAmount", "filePath", "totalAmount", "dueAmount"]) {
        expect(raw).not.toContain(forbidden);
      }
    } finally {
      await admin.context.close();
    }
  });

  test("rejects an unauthenticated request", async ({ request }) => {
    const response = await request.get("/api/search?q=demo");
    expect(response.status()).toBe(401);
  });

  test("below the minimum query length returns no results without erroring", async ({ browser }) => {
    const admin = await createCompanyAdminSession(browser);
    try {
      const { status, body } = await search(admin.context.request, "d");
      expect(status).toBe(200);
      expect(body.results).toEqual([]);
    } finally {
      await admin.context.close();
    }
  });

  test("malformed and adversarial queries do not error and return safe empty/bounded results", async ({ browser }) => {
    const admin = await createCompanyAdminSession(browser);
    try {
      const oversized = "x".repeat(5000);
      const sqlWildcards = "%_%_DEMO%";
      const scriptLike = "<script>alert(1)</script>";
      const emptyQuery = "";

      for (const q of [oversized, sqlWildcards, scriptLike, emptyQuery]) {
        const { status, body } = await search(admin.context.request, q);
        expect(status).toBe(200);
        expect(body.ok).toBe(true);
        expect(Array.isArray(body.results)).toBe(true);
      }

      // Several distinct queries fired back-to-back must each resolve with results
      // that belong only to their own query (no cross-request bleed on the server).
      const [shipmentOnly, invoiceOnly] = await Promise.all([
        search(admin.context.request, "JOB-DEMO-2026-0001"),
        search(admin.context.request, "INV-DEMO-2026-0001"),
      ]);
      expect(shipmentOnly.body.results.every((r) => r.type !== "invoice")).toBe(true);
      expect(invoiceOnly.body.results.every((r) => r.type !== "shipment")).toBe(true);
    } finally {
      await admin.context.close();
    }
  });

  test("a role without customer/vendor permission gets no customer or vendor rows even on a matching query", async ({ page }) => {
    await loginAsCompanyUser(page, "docs@freightcontrol.com");
    const { status, body } = await search(page.context().request, "Bengal Apparel");
    expect(status).toBe(200);
    expect(body.results.some((r) => r.type === "customer")).toBe(false);

    const vendor = await search(page.context().request, "Blue Horizon");
    expect(vendor.body.results.some((r) => r.type === "vendor")).toBe(false);

    // The same role does have shipments:view, so shipment search still works.
    const shipment = await search(page.context().request, "JOB-DEMO-2026-0001");
    expect(shipment.body.results.some((r) => r.type === "shipment")).toBe(true);
  });

  test("a branch-restricted user cannot search up a Head Office shipment", async ({ browser }) => {
    const restricted = await browser.newContext();
    const restrictedPage = await restricted.newPage();
    await loginAsCompanyUser(restrictedPage, "operations@freightcontrol.com");

    const admin = await createCompanyAdminSession(browser);
    try {
      const restrictedResult = await search(restrictedPage.context().request, "JOB-DEMO-2026-0001");
      expect(restrictedResult.body.results.some((r) => r.type === "shipment")).toBe(false);

      const adminResult = await search(admin.context.request, "JOB-DEMO-2026-0001");
      expect(adminResult.body.results.some((r) => r.type === "shipment")).toBe(true);
    } finally {
      await Promise.allSettled([restricted.close(), admin.context.close()]);
    }
  });

  test("per-entity results are capped even when far more records match", async ({ page }) => {
    test.setTimeout(60_000);
    await loginAsCompanyUser(page, "admin@freightcontrol.com");
    const prefix = generateTestName("SEARCHCAP");

    await page.goto("/dashboard/customers");
    await waitForHydration(page);
    for (let i = 0; i < 6; i += 1) {
      await page.fill("#name", `${prefix} ${i}`);
      await page.getByRole("button", { name: "Create Customer" }).click();
      await expect(page.getByText(`${prefix} ${i}`, { exact: true }).first()).toBeVisible({ timeout: 10_000 });
    }

    const { body } = await search(page.context().request, prefix);
    const customerResults = body.results.filter((r) => r.type === "customer");
    expect(customerResults.length).toBe(5);
    expect(body.results.length).toBeLessThanOrEqual(25);
  });

  test("the header search input renders results and supports keyboard dismissal", async ({ page }) => {
    await loginAsCompanyUser(page, "admin@freightcontrol.com");
    await page.goto("/dashboard");
    await waitForHydration(page);

    const input = page.getByRole("combobox", { name: /Search jobs/i });
    await input.fill("d");
    await expect(page.getByRole("listbox")).toHaveCount(0);

    await input.fill("JOB-DEMO-2026-0001");
    const listbox = page.getByRole("listbox");
    await expect(listbox).toBeVisible({ timeout: 5_000 });
    await expect(listbox.getByText("JOB-DEMO-2026-0001", { exact: true })).toBeVisible({ timeout: 5_000 });

    await page.keyboard.press("Escape");
    await expect(listbox).toHaveCount(0);
  });

  test("clicking a header search result navigates to the record", async ({ page }) => {
    await loginAsCompanyUser(page, "admin@freightcontrol.com");
    await page.goto("/dashboard");
    await waitForHydration(page);

    const input = page.getByRole("combobox", { name: /Search jobs/i });
    await input.fill("JOB-DEMO-2026-0001");
    const option = page.getByRole("option", { name: /JOB-DEMO-2026-0001/ });
    await expect(option).toBeVisible({ timeout: 5_000 });
    await option.click();

    await page.waitForURL(/\/dashboard\/shipments\/[a-zA-Z0-9-]+$/, { timeout: 10_000 });
  });
});
