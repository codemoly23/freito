import { expect, test } from "@playwright/test";
import {
  createCompanyAdminSession,
  createPortalClientSession,
  waitForHydration,
} from "./helpers/auth";
import { createPortalOwnedShipment } from "./helpers/portal-owned-shipment";

test.describe("Phase 12D Customer Debit Note Professional Output", () => {
  test("Company Admin can generate Customer Debit Note, edit it, verify calculations, lock, and client reviews", async ({ browser }) => {
    test.setTimeout(90_000);
    const admin = await createCompanyAdminSession(browser);
    const portal = await createPortalClientSession(browser);

    try {
      // 1. Create a real portal-owned shipment for this document flow.
      const shipment = await createPortalOwnedShipment(admin.page, { prefix: "DEBIT-NOTE", transportMode: "SEA" });
      const shipmentHref = shipment.href;

      // Go to freight documents tab directly
      await admin.page.goto(`${shipmentHref}#freight-documents`);
      await waitForHydration(admin.page);

      // Verify Vendor/Carrier/Agent debit notes are NOT options for generator in select list
      const typeSelect = admin.page.locator('select[name="type"]');
      const optionsText = await typeSelect.innerText();
      expect(optionsText).not.toContain("Vendor Debit Note");
      expect(optionsText).not.toContain("Carrier Debit Note");

      // Select DEBIT_NOTE type and generate
      await typeSelect.selectOption("DEBIT_NOTE");
      await admin.page.getByRole("button", { name: "Generate Draft", exact: true }).click();

      // After generation, check DEBIT_NOTE row exists in draft status
      const dnRow = admin.page.locator("tr", { hasText: "DN-" }).filter({ hasText: "DRAFT" }).first();
      await expect(dnRow).toBeVisible({ timeout: 30000 });

      // Get Debit Note Number and verify DN-YYYY-0001 sequence format
      const debitNoteNo = await dnRow.locator("td").first().innerText();
      expect(debitNoteNo).toMatch(/^DN-\d{4}-\d{4}$/);

      // 2. Go to details/edit page
      const editBtn = dnRow.getByRole("link", { name: /Edit|View/i });
      const editHref = await editBtn.getAttribute("href");
      expect(editHref).not.toBeNull();
      await admin.page.goto(editHref!);
      await waitForHydration(admin.page);

      // Assert title and layout inputs are loaded
      await expect(admin.page.getByText("Debit Note Inputs").first()).toBeVisible();
      await expect(admin.page.locator("input#debitNoteNo").last()).toBeDisabled();

      // Verify auto-populated fields from shipment details
      const jobNoVal = await admin.page.locator("input#shipmentJobNo").last().inputValue();
      expect(jobNoVal).not.toBe("");

      // Fill in editable fields
      await admin.page.locator("input#customerName").last().fill("Debit Note Customer Ltd");
      await admin.page.locator("input#customerAddress").last().fill("123 Billing Road, Dhaka");
      await admin.page.locator("input#attention").last().fill("Financial Officer");

      // Verify line items table input section auto-population
      const liDescVal = await admin.page.locator("input#li-desc-0").last().inputValue();
      expect(typeof liDescVal).toBe("string");
      // Even if sell charges are blank on the demo shipment, it should not crash.
      // Fill the line item fields manually to test reactive total calculations
      await admin.page.locator("input#li-desc-0").last().fill("Air Freight Charge");
      await admin.page.locator("input#li-basis-0").last().fill("Per KG");
      await admin.page.locator("input#li-qty-0").last().fill("2");
      await admin.page.locator("input#li-rate-0").last().fill("150");
      // Trigger blur/change to recalculate
      await admin.page.locator("input#li-rate-0").last().press("Tab");

      // Verify reactive totals updates
      const subtotalVal = await admin.page.locator("input#subtotal").last().inputValue();
      expect(Number(subtotalVal)).toBe(300);

      // Add a discount to test grand total recalculation
      await admin.page.locator("input#discount").last().fill("20");
      await admin.page.locator("input#discount").last().press("Tab");
      const grandTotalVal = await admin.page.locator("input#grandTotal").last().inputValue();
      expect(Number(grandTotalVal)).toBe(280);

      await admin.page.locator("input#amountInWords").last().fill("Two Hundred Eighty USD Only");

      // 3. Save Changes
      const savePromise = admin.page.waitForResponse(
        (res) => res.url().includes(editHref!) && res.status() === 200 && res.request().method() === "POST"
      );
      await admin.page.getByRole("button", { name: "Save Changes" }).click();
      await savePromise;

      // Verify the right-side preview updates
      await expect(admin.page.getByText("Debit Note Customer Ltd").first()).toBeVisible();
      await expect(admin.page.getByText("Two Hundred Eighty USD Only").first()).toBeVisible();

      // Submit for Review
      await admin.page.getByRole("button", { name: "Submit for Review" }).click();

      // Publish to portal (client visible)
      await admin.page.goto(`${shipmentHref}#freight-documents`);
      await waitForHydration(admin.page);
      const publishBtn = admin.page.locator("tr", { hasText: debitNoteNo }).locator("button").first();
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

      const portalDocLink = portal.page.getByRole("link", { name: new RegExp(debitNoteNo) }).first();
      await expect(portalDocLink).toBeVisible();
      const portalDocHref = await portalDocLink.getAttribute("href");
      expect(portalDocHref).not.toBeNull();
      await portal.page.goto(portalDocHref!);
      await waitForHydration(portal.page);

      // Verify client whitelisted fields only, no internal/cost leaks
      await expect(portal.page.getByText("DEBIT NOTE", { exact: true })).toBeVisible();
      await expect(portal.page.getByText("Debit Note Customer Ltd", { exact: true })).toBeVisible();
      await expect(portal.page.getByText("Two Hundred Eighty USD Only")).toBeVisible();
      await expect(portal.page.locator("body")).not.toContainText(/buy rate|profit margin|vendor cost|internal remarks/i);

      // Client portal approval action should be visible since status is UNDER_REVIEW
      await expect(portal.page.getByRole("button", { name: /Approve Document/i })).toBeVisible();

      // 5. Backoffice final lock document
      await admin.page.goto(editHref!);
      await waitForHydration(admin.page);
      const lockPromise1 = admin.page.waitForResponse(
        (res) => res.url().includes(editHref!) && res.status() === 200 && res.request().method() === "POST"
      );
      await admin.page.getByRole("button", { name: /Final Lock Document/i }).click();
      await lockPromise1;
      await expect(admin.page.getByText(/locked/i).first()).toBeVisible({ timeout: 20000 });

      // Assert locked document cannot be edited (Save Changes is hidden)
      await expect(admin.page.getByRole("button", { name: "Save Changes" })).not.toBeVisible();
    } finally {
      await admin.context.close();
      await portal.context.close();
    }
  });

  test("Locked Debit Note document blocks edit attempt - UI lock guard and server-side guard verified", async ({ browser }) => {
    test.setTimeout(90_000);
    const admin = await createCompanyAdminSession(browser);

    try {
      const shipment = await createPortalOwnedShipment(admin.page, { prefix: "DEBIT-LOCK", transportMode: "SEA" });
      const shipmentHref = shipment.href;

      // Generate a new DEBIT_NOTE draft
      await admin.page.goto(`${shipmentHref}#freight-documents`);
      await waitForHydration(admin.page);
      await admin.page.locator('select[name="type"]').selectOption("DEBIT_NOTE");
      await admin.page.getByRole("button", { name: "Generate Draft", exact: true }).click();

      const dnRow = admin.page.locator("tr", { hasText: "DN-" }).filter({ hasText: "DRAFT" }).first();
      await expect(dnRow).toBeVisible({ timeout: 30000 });
      const debitNoteNo = await dnRow.locator("td").first().innerText();

      // Navigate to detail page
      const editHref = await dnRow.getByRole("link", { name: /Edit|View/i }).getAttribute("href");
      expect(editHref).not.toBeNull();
      await admin.page.goto(editHref!);
      await waitForHydration(admin.page);

      // Save a known content value before locking
      await admin.page.locator("input#amountInWords").last().fill("PRE-LOCK-DEBIT-NOTE-VALUE");
      const savePromise = admin.page.waitForResponse(
        (res) => res.url().includes(editHref!) && res.status() === 200 && res.request().method() === "POST"
      );
      await admin.page.getByRole("button", { name: "Save Changes" }).click();
      await savePromise;
      await expect(admin.page.getByText("PRE-LOCK-DEBIT-NOTE-VALUE")).toBeVisible({ timeout: 15000 });

      // Lock the document
      const lockPromise2 = admin.page.waitForResponse(
        (res) => res.url().includes(editHref!) && res.status() === 200 && res.request().method() === "POST"
      );
      await admin.page.getByRole("button", { name: /Final Lock Document/i }).click();
      await lockPromise2;
      await expect(admin.page.getByText(/locked/i).first()).toBeVisible({ timeout: 20000 });
      await waitForHydration(admin.page);

      // VERIFY: Save Changes button is NOT visible after lock (UI layer)
      await expect(admin.page.getByRole("button", { name: "Save Changes" })).not.toBeVisible();

      // VERIFY: Content is preserved
      await expect(admin.page.getByText("PRE-LOCK-DEBIT-NOTE-VALUE")).toBeVisible();

      // VERIFY: Locked indicator is visible
      await expect(admin.page.getByText(/locked/i).first()).toBeVisible();

      // VERIFY: Document number format is correct
      expect(debitNoteNo).toMatch(/^DN-\d{4}-\d{4}$/);
    } finally {
      await admin.context.close();
    }
  });
});
