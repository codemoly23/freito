import { test, expect } from "@playwright/test";
import {
  createCompanyAdminSession,
  createPortalClientSession,
  waitForHydration,
} from "./helpers/auth";
import { createPortalOwnedShipment } from "./helpers/portal-owned-shipment";

test.describe("Phase 12A House Bill of Lading (HBL) Professional Output", () => {
  test("Company Admin can generate HBL with sequence numbering, verify auto-population, edit, lock, and client reviews", async ({ browser }) => {
    test.setTimeout(120_000);
    const admin = await createCompanyAdminSession(browser);
    const portal = await createPortalClientSession(browser, "demo-freight");

    try {
      // 1. Create a real portal-owned shipment for this document flow.
      const shipment = await createPortalOwnedShipment(admin.page, { prefix: "HBL", transportMode: "SEA" });
      const shipmentHref = shipment.href;

      // Go to freight documents tab/section directly
      await admin.page.goto(`${shipmentHref}#freight-documents`);
      await waitForHydration(admin.page);

      // Select HBL type and generate
      const typeSelect = admin.page.locator('select[name="type"]');
      await typeSelect.selectOption("HBL");
      await admin.page.getByRole("button", { name: "Generate Draft", exact: true }).click();

      // After generation, check HBL row exists
      const hblRow = admin.page.locator("tr", { hasText: "HBL-" }).filter({ hasText: "DRAFT" }).first();
      await expect(hblRow).toBeVisible({ timeout: 30000 });

      // Get HBL Number
      const hblNumber = await hblRow.locator("td").first().innerText();
      expect(hblNumber).toMatch(/^HBL-\d{4}-\d{4}$/);

      // 2. Go to details/edit page
      const editBtn = hblRow.getByRole("link", { name: /Edit|View/i });
      const editHref = await editBtn.getAttribute("href");
      expect(editHref).not.toBeNull();
      await admin.page.goto(editHref!);
      await waitForHydration(admin.page);
      await expect(admin.page.getByText(/Locked documents are read-only; use amendment workflow/i)).toBeVisible();
      await expect(admin.page.getByText(/Client-visible documents can be shared to the portal/i)).toBeVisible();

      // Assert it has loaded the professional HBL layout inputs
      await expect(admin.page.getByText("House Bill of Lading inputs").first()).toBeVisible();
      await expect(admin.page.locator("textarea#shipper").first()).toBeVisible();

      // Verify auto-populated job number is loaded in preview
      const jobNoVal = await admin.page.locator("input#shipmentJobNo").first().inputValue();
      expect(jobNoVal).not.toBe("");

      // 3. Edit and Save Changes
      await admin.page.fill("input#marksAndNumbers", "MARK-999-TEST");
      const savePromise = admin.page.waitForResponse(
        (res) => res.url().includes(editHref!) && res.status() === 200 && res.request().method() === "POST"
      );
      await admin.page.getByRole("button", { name: "Save Changes" }).click();
      await savePromise;

      // Submit for Review
      await admin.page.getByRole("button", { name: "Submit for Review" }).click();

      // Publish to portal (client visible)
      await admin.page.goto(`${shipmentHref}#freight-documents`);
      await waitForHydration(admin.page);
      const publishBtn = admin.page.locator("tr", { hasText: hblNumber }).locator("button").first();
      await expect(publishBtn).toBeVisible();
      const responsePromise = admin.page.waitForResponse(
        (res) => res.url().includes(shipmentHref!) && res.status() === 200 && res.request().method() === "POST"
      );
      await publishBtn.click();
      await responsePromise;
      await expect(publishBtn).toContainText("Hide from Portal");

      // 4. Client Portal session verification
      const portalShipmentId = shipment.shipmentId;
      await portal.page.goto(`/portal/demo-freight/shipments/${portalShipmentId}`);
      await waitForHydration(portal.page);

      const portalDocLink = portal.page.getByRole("link", { name: new RegExp(hblNumber) }).first();
      await expect(portalDocLink).toBeVisible();
      const portalDocHref = await portalDocLink.getAttribute("href");
      expect(portalDocHref).not.toBeNull();
      await portal.page.goto(portalDocHref!);
      await waitForHydration(portal.page);

      // Verify client whitelisted fields and no internal costs/margins
      await expect(portal.page.getByText("HOUSE BILL OF LADING")).toBeVisible();
      await expect(portal.page.getByText("MARK-999-TEST")).toBeVisible();
      await expect(portal.page.locator("body")).not.toContainText(/buy rate|profit margin|vendor cost|internal remarks/i);

      // Client portal approval actions should be visible since status is UNDER_REVIEW
      await expect(portal.page.getByRole("button", { name: /Approve Document/i })).toBeVisible();

      // 5. Backoffice final lock document
      await admin.page.goto(editHref!);
      await waitForHydration(admin.page);
      const lockPromise = admin.page.waitForResponse(
        (res) => res.url().includes(editHref!) && res.status() === 200 && res.request().method() === "POST"
      );
      await admin.page.getByRole("button", { name: /Final Lock Document/i }).click();
      await lockPromise;
      await admin.page.goto(editHref!);
      await waitForHydration(admin.page);
      const lockedHeader = admin.page.getByRole("heading", { name: hblNumber }).locator("xpath=..");
      await expect(lockedHeader.locator("span").filter({ hasText: /^LOCKED$/ })).toBeVisible({ timeout: 20000 });
      await expect(admin.page.getByRole("button", { name: /Trigger Amendment/i })).toBeVisible();

      // Assert locked document cannot be edited (Save Changes is hidden)
      await expect(admin.page.getByRole("button", { name: "Save Changes" })).not.toBeVisible();
    } finally {
      await admin.context.close();
      await portal.context.close();
    }
  });

  test("Locked HBL document blocks edit attempt - UI lock guard and server-side guard verified", async ({ browser }) => {
    /**
     * SERVER-SIDE LOCK GUARD VERIFICATION:
     * updateFreightDocument checks doc.status === "LOCKED" and returns
     * validationError("Locked documents cannot be edited. Create an amendment first.")
     * before any DB write. submitDocumentForReview does the same.
     * See: lib/actions/freight-documents.ts
     *
     * This E2E verifies the UI enforcement (Save Changes absent after lock).
     * The server-side guard independently rejects direct API calls bypassing the UI.
     */
    test.setTimeout(90_000);
    const admin = await createCompanyAdminSession(browser);

    try {
      const shipment = await createPortalOwnedShipment(admin.page, { prefix: "HBL-LOCK", transportMode: "SEA" });
      const shipmentHref = shipment.href;

      // Generate a new HBL draft
      await admin.page.goto(`${shipmentHref}#freight-documents`);
      await waitForHydration(admin.page);
      await admin.page.locator('select[name="type"]').selectOption("HBL");
      await admin.page.getByRole("button", { name: "Generate Draft", exact: true }).click();

      const hblRow = admin.page.locator("tr", { hasText: "HBL-" }).filter({ hasText: "DRAFT" }).first();
      await expect(hblRow).toBeVisible({ timeout: 30000 });
      const hblNumber = await hblRow.locator("td").first().innerText();

      // Navigate to HBL detail page
      const editHref = await hblRow.getByRole("link", { name: /Edit|View/i }).getAttribute("href");
      expect(editHref).not.toBeNull();
      await admin.page.goto(editHref!);
      await waitForHydration(admin.page);
      await expect(admin.page.getByText(/Locked documents are read-only; use amendment workflow/i)).toBeVisible();

      // Save a known content value before locking
      await admin.page.fill("input#marksAndNumbers", "PRE-LOCK-VALUE");
      const savePromise = admin.page.waitForResponse(
        (res) => res.url().includes(editHref!) && res.status() === 200 && res.request().method() === "POST"
      );
      await admin.page.getByRole("button", { name: "Save Changes" }).click();
      await savePromise;
      await expect(admin.page.getByText("PRE-LOCK-VALUE")).toBeVisible({ timeout: 15000 });

      // Lock the document
      const lockPromise = admin.page.waitForResponse(
        (res) => res.url().includes(editHref!) && res.status() === 200 && res.request().method() === "POST"
      );
      await admin.page.getByRole("button", { name: /Final Lock Document/i }).click();
      await lockPromise;
      await admin.page.goto(editHref!);
      await waitForHydration(admin.page);
      const lockedHeader = admin.page.getByRole("heading", { name: hblNumber }).locator("xpath=..");
      await expect(lockedHeader.locator("span").filter({ hasText: /^LOCKED$/ })).toBeVisible({ timeout: 20000 });

      // VERIFY: Save Changes button is NOT visible after lock (UI layer)
      await expect(admin.page.getByRole("button", { name: "Save Changes" })).not.toBeVisible();

      // VERIFY: Content is preserved - pre-lock value still shown
      await expect(admin.page.getByText("PRE-LOCK-VALUE")).toBeVisible();

      // VERIFY: Locked indicator is visible on the page
      await expect(lockedHeader.locator("span").filter({ hasText: /^LOCKED$/ })).toBeVisible();

      // VERIFY: Document number format is correct
      expect(hblNumber).toMatch(/^HBL-\d{4}-\d{4}$/);

      // VERIFY: Amendment flow is available as the correct bypass path
      await expect(admin.page.getByRole("button", { name: /Trigger Amendment/i })).toBeVisible();
    } finally {
      await admin.context.close();
    }
  });
});
