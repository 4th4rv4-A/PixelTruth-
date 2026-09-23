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
    await fileChooser.setFiles(path.join(process.cwd(), 'tests', 'fixtures', 'generated', 'valid.jpg'));

    // Wait for it to appear in the queue
    await expect(page.locator('.frame').first()).toBeVisible();
    await expect(page.locator('text=valid.jpg')).toBeVisible();
  });

  test('Batch Clean and Download ZIP', async ({ page }) => {
    // Select multiple files
    const fileChooserPromise = page.waitForEvent('filechooser');
    await page.getByRole('button', { name: /upload images/i }).click();
    const fileChooser = await fileChooserPromise;
    
    await fileChooser.setFiles([
      path.join(process.cwd(), 'tests', 'fixtures', 'generated', 'valid.jpg'),
      path.join(process.cwd(), 'tests', 'fixtures', 'generated', 'valid.png')
    ]);

    // Click Clean All
    await page.locator('button:has-text("Clean All")').click();

    // Verify cleaning starts
    await expect(page.locator('text=PROCESSING')).toBeVisible();

    // In a real run, a ZIP download would start. Playwright handles the download promise.
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
    await expect(page.locator('text=Maximum 20 files allowed')).toBeVisible();
    
    // Should only add 20 files
    const count = await page.locator('.frame').count();
    expect(count).toBe(20);
  });
});
