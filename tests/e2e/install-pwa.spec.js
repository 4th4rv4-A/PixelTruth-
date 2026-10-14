import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test.describe('Universal PWA Install Feature', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('Dedicated Install App button is rendered in the header', async ({ page }) => {
    const installBtn = page.locator('#install-app-button');
    await expect(installBtn).toBeVisible();
    await expect(installBtn).toHaveText(/Install/i);
  });

  test('Clicking Install button opens the universal InstallModal', async ({ page }) => {
    const installBtn = page.locator('#install-app-button');
    await installBtn.click();

    const dialog = page.locator('[role="dialog"][aria-modal="true"]');
    await expect(dialog).toBeVisible();
    await expect(dialog.locator('#install-modal-title')).toHaveText(/Install PixelTruth/i);

    // Verify tabs are available
    await expect(page.locator('button:has-text("iPhone / iPad")')).toBeVisible();
    await expect(page.locator('button:has-text("Android")')).toBeVisible();
    await expect(page.locator('button:has-text("Laptop & Desktop")')).toBeVisible();

    // Verify iOS instructions
    await page.locator('button:has-text("iPhone / iPad")').click();
    await expect(page.locator('text=Apple Safari')).toBeVisible();
    await expect(page.locator('text=Add to Home Screen')).toBeVisible();

    // Verify Android instructions
    await page.locator('button:has-text("Android")').click();
    await expect(page.locator('text=Open the Chrome menu')).toBeVisible();

    // Verify Desktop instructions
    await page.locator('button:has-text("Laptop & Desktop")').click();
    await expect(page.locator('text=Browser Address Bar')).toBeVisible();

    // Close modal via Escape key
    await page.keyboard.press('Escape');
    await expect(dialog).not.toBeVisible();
  });

  test('InstallModal has no accessibility violations', async ({ page }) => {
    await page.locator('#install-app-button').click();
    await expect(page.locator('[role="dialog"]')).toBeVisible();

    const accessibilityScanResults = await new AxeBuilder({ page })
      .include('[role="dialog"]')
      .analyze();

    expect(accessibilityScanResults.violations).toEqual([]);
  });
});
