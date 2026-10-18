import { test, expect } from '@playwright/test';
import path from 'path';

test.describe('Core Flows', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('Upload via file input', async ({ page }) => {
    const fileChooserPromise = page.waitForEvent('filechooser');
    await page.getByRole('button', { name: /upload images/i }).click();
    const fileChooser = await fileChooserPromise;
    
    // We would use our generated fixture here
    await fileChooser.setFiles(path.join(process.cwd(), 'tests', 'fixtures', 'realistic', 'canon_eos_portrait.jpg'));

    // Wait for it to appear in the queue
    await expect(page.locator('.frame').first()).toBeVisible();
    await expect(page.locator('text=canon_eos_portrait.jpg').first()).toBeVisible();
  });

  test('Batch Clean and Download ZIP', async ({ page }) => {
    // Select multiple files
    const fileChooserPromise = page.waitForEvent('filechooser');
    await page.getByRole('button', { name: /upload images/i }).click();
    const fileChooser = await fileChooserPromise;
    
    await fileChooser.setFiles([
      path.join(process.cwd(), 'tests', 'fixtures', 'realistic', 'canon_eos_portrait.jpg'),
      path.join(process.cwd(), 'tests', 'fixtures', 'realistic', 'clean_screenshot.png')
    ]);

    // Set up download promise before clicking Clean All
    const downloadPromise = page.waitForEvent('download');
    await page.locator('button:has-text("Clean All")').click();

    // Wait for the ZIP download to start
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toBe('pixeltruth-cleaned.zip');
  });

  test('File Queue Limits', async ({ page }) => {
    const dt = await page.evaluateHandle(() => {
      const dataTransfer = new DataTransfer();
      for(let i = 0; i < 25; i++) {
        const u8 = new Uint8Array([
          0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0x00, 0x00, 0x00, 0x0D, 0x49, 0x48, 0x44, 0x52, 
          0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01, 0x08, 0x02, 0x00, 0x00, 0x00, 0x90, 0x77, 0x53, 
          0xDE, 0x00, 0x00, 0x00, 0x0C, 0x49, 0x44, 0x41, 0x54, 0x08, 0xD7, 0x63, 0xF8, 0xCF, 0xC0, 0x00, 
          0x00, 0x03, 0x01, 0x01, 0x00, 0x18, 0xDD, 0x8D, 0xB0, 0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4E, 
          0x44, 0xAE, 0x42, 0x60, 0x82
        ]);
        const file = new File([u8], `sample-${i}.png`, { type: 'image/png' });
        dataTransfer.items.add(file);
      }
      return dataTransfer;
    });

    await page.dispatchEvent('#dropzone', 'drop', { dataTransfer: dt });

    // Should show a toast notification
    await expect(page.locator('text=/Only 20 more files can be added|Maximum 20 files allowed/')).toBeVisible();
    
    // Should only add 20 files to the queue
    await expect(page.locator('[role="button"][aria-label^="Inspect metadata for"]')).toHaveCount(20);
  });
});
