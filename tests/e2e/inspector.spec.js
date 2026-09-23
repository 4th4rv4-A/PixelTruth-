import { test, expect } from '@playwright/test';
import path from 'path';

test.describe('Inspector View', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    // Switch to Inspect Tab
    await page.locator('#tab-inspect').click();
  });

  test('Load image and generate report', async ({ page }) => {
    const fileChooserPromise = page.waitForEvent('filechooser');
    await page.locator('text=Click to select files').click();
    const fileChooser = await fileChooserPromise;
    
    await fileChooser.setFiles(path.join(process.cwd(), 'tests', 'fixtures', 'generated', 'valid.jpg'));

    // Wait for the UI to transition
    await expect(page.locator('text=File Identity')).toBeVisible();
    await expect(page.locator('text=valid.jpg')).toBeVisible();

    // The workers will run. Wait for HexViewer to populate
    await expect(page.locator('.font-mono', { hasText: 'FF D8 FF' }).first()).toBeVisible({ timeout: 10000 });

    // Export JSON Report
    const downloadPromise = page.waitForEvent('download');
    await page.locator('button:has-text("Export JSON")').click();
    const download = await downloadPromise;

    expect(download.suggestedFilename()).toMatch(/pixeltruth-report-.*\.json/);
  });
});
