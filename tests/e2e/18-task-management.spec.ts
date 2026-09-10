import "dotenv/config";
import { expect, test } from "@playwright/test";
import mariadb from "mariadb";
import { randomUUID } from "node:crypto";
import {
  createCompanyAdminSession,
  createPlatformSession,
  createPortalClientSession,
  loginAsCompanyUser,
} from "./helpers/auth";
import { generateTestEmail, generateTestName } from "./helpers/test-data";

test.describe("Phase 8H Task Management and Team Collaboration", () => {
  test("Company Admin can create, link, assign, filter, comment, and complete a task", async ({ browser }) => {
    test.setTimeout(90_000);
    const admin = await createCompanyAdminSession(browser);
    const title = generateTestName("Shipment follow-up task");
    const operationsAssignee = "Operations Manager";
    try {
      await admin.page.goto("/dashboard/tasks");
      await expect(admin.page.getByRole("heading", { name: "Tasks", exact: true })).toBeVisible();
      await expect(admin.page.getByText("My open tasks", { exact: true })).toBeVisible();

      await admin.page.goto("/dashboard/shipments");
      const shipmentRow = admin.page.getByRole("row").nth(1);
      const shipmentNo = (await shipmentRow.locator("td").first().innerText()).split(/\r?\n/)[0].trim();
      const shipmentPath = await shipmentRow.getByRole("link", { name: "View" }).getAttribute("href");
      expect(shipmentPath).toBeTruthy();
      await admin.page.goto(shipmentPath!);
      await expect(admin.page).toHaveURL(new RegExp(`${shipmentPath!.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`));
      await expect(admin.page.getByRole("link", { name: "Create Task" })).toBeVisible();
      await admin.page.getByRole("link", { name: "Create Task" }).click();
      await expect(admin.page.getByRole("heading", { name: "Create Task" })).toBeVisible();
      await expect(admin.page.locator('select[name="shipmentJobId"]')).not.toHaveValue("");
      await admin.page.fill('input[name="title"]', title);
      await admin.page.fill('textarea[name="description"]', "Coordinate the next customer-safe shipment milestone.");
      await admin.page.selectOption('select[name="priority"]', "HIGH");
      await admin.page.selectOption('select[name="assignedUserId"]', { label: operationsAssignee });
      await admin.page.fill('input[name="dueDate"]', new Date(Date.now() + 86400000).toISOString().slice(0, 10));
      await admin.page.getByRole("button", { name: "Create task" }).click();
      await admin.page.waitForURL((url) => url.pathname === shipmentPath);

      await admin.page.goto(`/dashboard/tasks?q=${encodeURIComponent(title)}&status=TODO&priority=HIGH`);
      const taskCard = admin.page.locator("section > div.rounded-lg").filter({ hasText: title }).first();
      await expect(taskCard).toBeVisible();
      await expect(taskCard.getByText(operationsAssignee)).toBeVisible();
      await taskCard.getByRole("link", { name: title }).click();
      await expect(admin.page.getByText(shipmentNo, { exact: true })).toBeVisible();

      await admin.page.fill('textarea[name="body"]', "Documentation team has been informed.");
      await admin.page.getByRole("button", { name: "Add comment" }).click();
      await expect(admin.page.getByText("Documentation team has been informed.")).toBeVisible();

      await admin.page.selectOption('select[name="status"]', "DONE");
      await admin.page.getByRole("button", { name: "Save status" }).click();
      await expect(admin.page.getByText("DONE", { exact: true }).first()).toBeVisible();

      const operations = await browser.newPage();
      await loginAsCompanyUser(operations, "operations@freightcontrol.com");
      await operations.goto("/dashboard/notifications");
      await expect(operations.getByText("Task assigned", { exact: true }).first()).toBeVisible();
      await expect(operations.getByText(title, { exact: false }).first()).toBeVisible();
      await operations.close();
    } finally {
      await admin.context.close();
    }
  });

  test("Task list filters by status, priority, and assignee", async ({ browser }) => {
    const title = generateTestName("Filter task");
    const admin = await createCompanyAdminSession(browser);
    try {
      await admin.page.goto("/dashboard/tasks/new");
      await admin.page.fill('input[name="title"]', title);
      await admin.page.selectOption('select[name="priority"]', "URGENT");
      await admin.page.selectOption('select[name="assignedUserId"]', { label: "Documentation Officer" });
      await admin.page.getByRole("button", { name: "Create task" }).click();
      await admin.page.waitForURL(
        (url) => /^\/dashboard\/tasks\/[^/]+$/.test(url.pathname) && url.pathname !== "/dashboard/tasks/new",
      );
      await admin.page.goto("/dashboard/tasks?status=TODO&priority=URGENT");
      await expect(admin.page.getByRole("link", { name: title })).toBeVisible();
      await admin.page.selectOption('select[name="assignee"]', { label: "Documentation Officer" });
      await admin.page.getByRole("button", { name: "Filter" }).click();
      await expect(admin.page.getByRole("link", { name: title })).toBeVisible();
    } finally {
      await admin.context.close();
    }
  });

  test("Cross-company task access is denied", async ({ browser }) => {
    const url = new URL(process.env.DATABASE_URL!);
    const connection = await mariadb.createConnection({
      host: url.hostname,
      port: url.port ? Number(url.port) : 3306,
      user: decodeURIComponent(url.username),
      password: decodeURIComponent(url.password),
      database: url.pathname.replace(/^\//, ""),
    });
    const companyId = randomUUID();
    const branchId = randomUUID();
    const creatorId = randomUUID();
    const taskId = randomUUID();
    await connection.query("INSERT INTO Company (id, name, status, deploymentType, planType, subscriptionStatus, portalEnabled, createdAt, updatedAt) VALUES (?, ?, 'ACTIVE', 'CLOUD', 'TRIAL', 'TRIAL', false, NOW(), NOW())", [companyId, generateTestName("Task Isolation Company")]);
    await connection.query("INSERT INTO Branch (id, companyId, code, name, isActive, createdAt, updatedAt) VALUES (?, ?, 'HEAD_OFFICE', 'Head Office', true, NOW(), NOW())", [branchId, companyId]);
    await connection.query("INSERT INTO User (id, companyId, scope, name, email, status, createdAt, updatedAt) VALUES (?, ?, 'COMPANY', 'Isolation User', ?, 'ACTIVE', NOW(), NOW())", [creatorId, companyId, generateTestEmail("task-isolation")]);
    await connection.query("INSERT INTO Task (id, companyId, branchId, title, status, priority, createdById, createdAt, updatedAt) VALUES (?, ?, ?, 'Other tenant task', 'TODO', 'MEDIUM', ?, NOW(), NOW())", [taskId, companyId, branchId, creatorId]);
    const admin = await createCompanyAdminSession(browser);
    try {
      await admin.page.goto(`/dashboard/tasks/${taskId}`);
      await expect(admin.page.getByText("Page not found")).toBeVisible();
    } finally {
      await admin.context.close();
      await connection.query("DELETE FROM Task WHERE id = ?", [taskId]);
      await connection.query("DELETE FROM Company WHERE id = ?", [companyId]);
      await connection.end();
    }
  });

  test("Portal, platform, and users without task permission cannot access task creation", async ({ browser }) => {
    const portal = await createPortalClientSession(browser, "demo-freight");
    const platform = await createPlatformSession(browser);
    try {
      for (const session of [portal.page, platform.page]) {
        await session.goto("/dashboard/tasks");
        await expect(session).not.toHaveURL(/\/dashboard\/tasks$/);
        await session.goto("/dashboard/tasks/new");
        await expect(session).not.toHaveURL(/\/dashboard\/tasks\/new$/);
      }
    } finally {
      await Promise.allSettled([portal.context.close(), platform.context.close()]);
    }
  });
});
