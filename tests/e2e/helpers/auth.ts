import { Browser, Page, expect } from '@playwright/test';

export async function waitForHydration(page: Page) {
  await page.waitForFunction(() => document.documentElement.dataset.hydrated === "true");
}

export async function loginAsPlatformOwner(page: Page) {
  await page.goto('/platform-login');
  await waitForHydration(page);
  await expect(page.locator('button[type="submit"]')).toBeEnabled();
  await page.fill('input[id="email"]', 'platform@freightcontrol.com');
  await page.fill('input[id="password"]', 'Admin123');
  await page.click('button[type="submit"]');
  await expect(page).toHaveURL(/\/platform\/?$/, { timeout: 15_000 });
}

export async function loginAsCompanyAdmin(page: Page) {
  await page.goto('/login');
  await waitForHydration(page);
  await expect(page.locator('button[type="submit"]')).toBeEnabled();
  await page.fill('input[id="email"]', 'admin@freightcontrol.com');
  await page.fill('input[id="password"]', 'Admin123');
  await page.click('button[type="submit"]');
  await expect(page).toHaveURL(/\/dashboard\/?$/, { timeout: 15_000 });
}

export async function loginAsClientPortalUser(page: Page, companySlug: string = 'demo-freight') {
  await page.goto(`/portal/${companySlug}/login`);
  await waitForHydration(page);
  await expect(page.locator('button[type="submit"]')).toBeEnabled();
  await page.fill('input#clientCode', 'DFC-CL-2026-0001');
  await page.fill('input#clientPassword', 'Admin123');
  await page.click('button[type="submit"]');
  await expect(page).toHaveURL(new RegExp(`/portal/${companySlug}/?$`), { timeout: 15_000 });
}

export async function loginAsCompanyUser(page: Page, email: string) {
  await page.context().clearCookies();
  await page.goto('/login');
  await waitForHydration(page);
  await expect(page.locator('button[type="submit"]')).toBeEnabled();
  await page.fill('input[id="email"]', email);
  await page.fill('input[id="password"]', 'Admin123');
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
