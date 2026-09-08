import { expect, test } from "@playwright/test";
import { loginAsCompanyAdmin, loginAsCompanyUser } from "./helpers/auth";

test.describe("Branch management", () => {
  test("company administrator can open the branch directory", async ({ page }) => {
    await loginAsCompanyAdmin(page);
    await page.goto("/dashboard/branches");

    await expect(page.getByRole("heading", { name: "Branches" })).toBeVisible();
    await expect(page.getByText("Head Office", { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Create branch" })).toBeVisible();
  });

  test("a branch-restricted user cannot open a Head Office job", async ({ page }) => {
    // The disposable demo seed assigns this user only to CTG_OPS while this
    // deterministic record belongs to HEAD_OFFICE.
    await loginAsCompanyUser(page, "operations@freightcontrol.com");
    await page.goto("/dashboard/shipments");

    await expect(page.getByText("JOB-DEMO-2026-0001", { exact: true })).not.toBeVisible();
  });
});
