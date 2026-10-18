import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import path from 'path';

test.describe('Accessibility', () => {
  test('Initial page load has no accessibility violations', async ({ page }) => {
    await page.goto('/');
    
    const accessibilityScanResults = await new AxeBuilder({ page })
      .disableRules(['color-contrast'])
      .analyze();
    expect(accessibilityScanResults.violations).toEqual([]);
  });

  test('Page with a queued file has no accessibility violations', async ({ page }) => {
    await page.goto('/');

    // Add a file to the queue via file input
    const fileChooserPromise = page.waitForEvent('filechooser');
    await page.getByRole('button', { name: /upload images/i }).click();
    const fileChooser = await fileChooserPromise;
    await fileChooser.setFiles(path.join(process.cwd(), 'tests', 'fixtures', 'realistic', 'canon_eos_portrait.jpg'));

    // Wait for file to appear in the queue
    await expect(page.locator('text=canon_eos_portrait.jpg').first()).toBeVisible();

    const accessibilityScanResults = await new AxeBuilder({ page })
      .disableRules(['color-contrast'])
      .analyze();
    expect(accessibilityScanResults.violations).toEqual([]);
  });

  test('Page after a clean operation has no accessibility violations', async ({ page }) => {
    await page.goto('/');

    // Add a file
    const fileChooserPromise = page.waitForEvent('filechooser');
    await page.getByRole('button', { name: /upload images/i }).click();
    const fileChooser = await fileChooserPromise;
    await fileChooser.setFiles(path.join(process.cwd(), 'tests', 'fixtures', 'realistic', 'canon_eos_portrait.jpg'));

    await expect(page.locator('text=canon_eos_portrait.jpg').first()).toBeVisible();

    // Click Clean All and wait for processing to finish
    await page.locator('button:has-text("Clean All")').click();
    await page.waitForTimeout(3000); // Allow time for worker processing

    const accessibilityScanResults = await new AxeBuilder({ page })
      .disableRules(['color-contrast'])
      .analyze();
    expect(accessibilityScanResults.violations).toEqual([]);
  });
});
