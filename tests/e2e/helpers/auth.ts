import { Browser, Page, expect } from '@playwright/test';

// Demo account passwords were rotated for the live demo (2026-09-10). Accounts
// not listed here (e.g. docs@freightcontrol.com, admin@freightcontrol.com)
// were left untouched and still use the original default.
const COMPANY_USER_PASSWORDS: Record<string, string> = {
  'admin@freightfast-demo.codemoly.io': 'FreightFast@2026',
  'operations@freightcontrol.com': 'Staff@2026',
  'sales@freightcontrol.com': 'Staff@2026',
  'accounts@freightcontrol.com': 'Staff@2026',
  'documentation@freightcontrol.com': 'Staff@2026',
};
const DEFAULT_COMPANY_PASSWORD = 'Admin123';
const PLATFORM_OWNER_PASSWORD = 'Platform@2026';
const CLIENT_PORTAL_PASSWORD = 'Client@2026';

function passwordFor(email: string) {
  return COMPANY_USER_PASSWORDS[email] ?? DEFAULT_COMPANY_PASSWORD;
}

export async function waitForHydration(page: Page) {
  await page.waitForFunction(() => document.documentElement.dataset.hydrated === "true");
}

export async function loginAsPlatformOwner(page: Page) {
  await page.goto('/platform-login');
  await waitForHydration(page);
  await expect(page.locator('button[type="submit"]')).toBeEnabled();
  await page.fill('input[id="email"]', 'platform@freightcontrol.com');
  await page.fill('input[id="password"]', PLATFORM_OWNER_PASSWORD);
  await page.click('button[type="submit"]');
  await expect(page).toHaveURL(/\/platform\/?$/, { timeout: 15_000 });
}

export async function loginAsCompanyAdmin(page: Page) {
  await page.goto('/login');
  await waitForHydration(page);
  await expect(page.locator('button[type="submit"]')).toBeEnabled();
  await page.fill('input[id="email"]', 'admin@freightcontrol.com');
  await page.fill('input[id="password"]', passwordFor('admin@freightcontrol.com'));
  await page.click('button[type="submit"]');
  await expect(page).toHaveURL(/\/dashboard\/?$/, { timeout: 15_000 });
}

export async function loginAsClientPortalUser(page: Page, companySlug: string = 'demo-freight') {
  await page.goto(`/portal/${companySlug}/login`);
  await waitForHydration(page);
  await expect(page.locator('button[type="submit"]')).toBeEnabled();
  await page.fill('input#clientCode', 'DFC-CL-2026-0001');
  await page.fill('input#clientPassword', CLIENT_PORTAL_PASSWORD);
  await page.click('button[type="submit"]');
  await expect(page).toHaveURL(new RegExp(`/portal/${companySlug}/?$`), { timeout: 15_000 });
}

export async function loginAsCompanyUser(page: Page, email: string) {
  await page.context().clearCookies();
  await page.goto('/login');
  await waitForHydration(page);
  await expect(page.locator('button[type="submit"]')).toBeEnabled();
  await page.fill('input[id="email"]', email);
  await page.fill('input[id="password"]', passwordFor(email));
  await page.click('button[type="submit"]');
  await page.waitForURL((url) => url.pathname.startsWith("/dashboard"), { timeout: 15_000 });
  if (new URL(page.url()).pathname !== "/dashboard") {
    await page.goto("/dashboard");
  }
  await waitForHydration(page);
}

export async function createCompanyAdminSession(browser: Browser) {
  const context = await browser.newContext();
  const page = await context.newPage();
  await loginAsCompanyAdmin(page);
  return { context, page };
}

export async function createPlatformSession(browser: Browser) {
  const context = await browser.newContext();
  const page = await context.newPage();
  await loginAsPlatformOwner(page);
  return { context, page };
}

export async function createPortalClientSession(
  browser: Browser,
  companySlug: string = 'demo-freight',
) {
  const context = await browser.newContext();
  const page = await context.newPage();
  await loginAsClientPortalUser(page, companySlug);
  return { context, page };
}
