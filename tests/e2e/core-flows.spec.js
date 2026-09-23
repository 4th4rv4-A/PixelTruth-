import { test, expect } from '@playwright/test';
import path from 'path';

test.describe('Core Flows', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('Upload via file input', async ({ page }) => {
    const fileChooserPromise = page.waitForEvent('filechooser');
    await page.locator('text=Click to select files').click();
    const fileChooser = await fileChooserPromise;
    
    // We would use our generated fixture here
    await fileChooser.setFiles(path.join(process.cwd(), 'tests', 'fixtures', 'generated', 'valid.jpg'));

    // Wait for it to appear in the queue
    await expect(page.locator('.frame').first()).toBeVisible();
    await expect(page.locator('text=valid.jpg')).toBeVisible();
  });

  test('Batch Clean and Download ZIP', async ({ page }) => {
    // Select multiple files
    const fileChooserPromise = page.waitForEvent('filechooser');
    await page.locator('text=Click to select files').click();
    const fileChooser = await fileChooserPromise;
    
    await fileChooser.setFiles([
      path.join(process.cwd(), 'tests', 'fixtures', 'generated', 'valid.jpg'),
      path.join(process.cwd(), 'tests', 'fixtures', 'generated', 'valid.png')
    ]);

    // Click Clean Selected
    await page.locator('button:has-text("Clean Selected")').click();

    // Verify cleaning starts (progress bars, etc.)
    await expect(page.locator('text=Processing')).toBeVisible();

    // Wait for completion and Download All button to appear
    await expect(page.locator('button:has-text("Download All")')).toBeVisible({ timeout: 15000 });

    // Download ZIP
    const downloadPromise = page.waitForEvent('download');
    await page.locator('button:has-text("Download All")').click();
    const download = await downloadPromise;
    
    expect(download.suggestedFilename()).toBe('pixeltruth-cleaned.zip');
  });

  test('File Queue Limits', async ({ page }) => {
    // Note: To test this realistically, we'd need to mock the file selection to pass 101 files,
    // or simulate dropping a massive DataTransfer object.
    const dt = await page.evaluateHandle(() => {
      const dataTransfer = new DataTransfer();
      for(let i=0; i<105; i++) {
        const file = new File(['mock'], `test-${i}.jpg`, { type: 'image/jpeg' });
        dataTransfer.items.add(file);
      }
      return dataTransfer;
    });

    await page.dispatchEvent('.border-dashed', 'drop', { dataTransfer: dt });

    // Should show a toast error
    await expect(page.locator('text=Maximum 100 files allowed')).toBeVisible();
    
    // Should only add 100 files
    const count = await page.locator('.frame').count();
    expect(count).toBe(100);
  });
});
