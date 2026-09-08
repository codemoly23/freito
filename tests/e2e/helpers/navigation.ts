import { Page } from '@playwright/test';

export async function navigateToDashboardModule(page: Page, moduleName: string) {
  // Assuming sidebar links have text or specific roles
  await page.click(`aside >> text=${moduleName}`);
}

export async function navigateToPlatformModule(page: Page, moduleName: string) {
  await page.click(`nav >> text=${moduleName}`);
}
