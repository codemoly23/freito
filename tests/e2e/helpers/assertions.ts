import { Page, expect } from '@playwright/test';

export async function assertToastMessage(page: Page, message: string | RegExp) {
  await expect(page.locator('role=status')).toContainText(message);
}

export async function assertPageTitle(page: Page, title: string | RegExp) {
  await expect(page.locator('h1')).toContainText(title);
}
