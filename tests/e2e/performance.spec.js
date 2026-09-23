import { test, expect } from '@playwright/test';

test.describe('Performance & Telemetry', () => {
  test('Initial Load Time', async ({ page }) => {
    // Record start time
    const startTime = Date.now();
    
    await page.goto('/');
    
    // Wait for main content to be visible
    await expect(page.locator('text=Clean your image metadata')).toBeVisible();
    
    const loadTime = Date.now() - startTime;
    console.log(`[Performance] Initial Load Time: ${loadTime}ms`);
    
    // Arbitrary threshold: ensure app shell loads under 2 seconds locally
    expect(loadTime).toBeLessThan(2000);
  });
});
