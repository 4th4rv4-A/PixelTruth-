import { test, expect } from '@playwright/test';
import path from 'path';
import fs from 'fs';
import JSZip from 'jszip';
import exifr from 'exifr';

const fixturesDir = path.resolve(process.cwd(), 'tests', 'fixtures', 'realistic');

test.describe('Real-World User Flows', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('Case 1: Smartphone Photo with GPS, metadata filtering, and selective preservation', async ({ page }) => {
    // 1. Upload iPhone photo with GPS
    const iphonePath = path.join(fixturesDir, 'iphone_gps_photo.jpg');
    await page.locator('input[type="file"]').setInputFiles(iphonePath);

    // 2. Wait for file to appear in queue
    await expect(page.locator('text=iphone_gps_photo.jpg').first()).toBeVisible();

    // 3. Verify High Privacy Risk badge for GPS
    await expect(page.locator('text=Contains GPS location').first()).toBeVisible();

    // 4. Verify tag detection count
    await expect(page.locator('text=26 tags detected')).toBeVisible();

    // 5. Test search filter
    const searchInput = page.locator('input[aria-label="Filter metadata tags by name or value"]');
    await searchInput.fill('GPS');
    await expect(page.locator('text=GPSLatitude').first()).toBeVisible();
    await expect(page.locator('text=GPSLongitude').first()).toBeVisible();

    // 6. Clear search filter
    await page.locator('button[aria-label="Clear search query"]').click();
    await expect(searchInput).toHaveValue('');

    // 7. Selective tag keeping: Keep Artist
    const keepArtistCheckbox = page.locator('input[aria-label="Keep Artist"]');
    await keepArtistCheckbox.click();
    await expect(keepArtistCheckbox).toBeChecked();

    // 8. Clean single image
    const singleRemoveExifBtn = page.locator('.frame button:has-text("REMOVE EXIF")').last();
    await singleRemoveExifBtn.click();

    // 9. Verify state transitions to CLEANED with SAVE button
    await expect(page.locator('button[aria-label="Save cleaned iphone_gps_photo.jpg"]')).toBeVisible({ timeout: 10000 });
  });

  test('Case 2: Canon DSLR Photo with Orientation & Filmstrip Management', async ({ page }) => {
    // 1. Upload Canon EOS portrait photo
    const canonPath = path.join(fixturesDir, 'canon_eos_portrait.jpg');
    await page.locator('input[type="file"]').setInputFiles(canonPath);

    // 2. Wait for file in queue
    await expect(page.locator('text=canon_eos_portrait.jpg').first()).toBeVisible();

    // 3. Verify Orientation is "Always kept" to preserve portrait rotation
    await expect(page.locator('text=Rotate 90 CW')).toBeVisible();
    await expect(page.locator('tr', { hasText: 'Orientation' }).getByText('Always kept')).toBeVisible();

    // 4. Verify device info
    await expect(page.locator('text=Canon EOS R6 Mark II')).toBeVisible();
    await expect(page.locator('text=RF85mm F1.2 L USM')).toBeVisible();

    // 5. Remove file from queue using card X button
    await page.locator('button[aria-label="Remove canon_eos_portrait.jpg"]').click();
    await expect(page.locator('text=canon_eos_portrait.jpg')).not.toBeVisible();
  });

  test('Case 3: Batch Upload, Full Sanitize, and ZIP Download with Size Report', async ({ page }) => {
    // 1. Upload 3 files
    await page.locator('input[type="file"]').setInputFiles([
      path.join(fixturesDir, 'iphone_gps_photo.jpg'),
      path.join(fixturesDir, 'canon_eos_portrait.jpg'),
      path.join(fixturesDir, 'clean_screenshot.png')
    ]);

    // 2. Verify queue counter shows 3
    await expect(page.locator('[role="button"][aria-label^="Inspect metadata for"]')).toHaveCount(3);

    // 3. Enable Full Sanitize
    const fullSanitizeCheckbox = page.locator('label:has-text("Full Sanitize") input[type="checkbox"]');
    await fullSanitizeCheckbox.check();
    await expect(fullSanitizeCheckbox).toBeChecked();

    // 4. Start batch clean and listen for ZIP download
    const downloadPromise = page.waitForEvent('download');
    await page.locator('#clean-button').click();

    // 5. Verify Size Comparison Report appears
    await expect(page.locator('text=Size Comparison Report')).toBeVisible({ timeout: 15000 });
    await expect(page.locator('button:has-text("SAVE ALL (ZIP)")')).toBeVisible();

    // 6. Verify ZIP download and contents
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toBe('pixeltruth-cleaned.zip');

    const downloadPath = await download.path();
    const zipData = fs.readFileSync(downloadPath);
    const zip = await JSZip.loadAsync(zipData);
    expect(Object.keys(zip.files)).toContain('iphone_gps_photo.jpg');
    expect(Object.keys(zip.files)).toContain('canon_eos_portrait.jpg');

    // 7. Verify GPS metadata was completely removed from the cleaned output
    const cleanedIphoneBuffer = await zip.file('iphone_gps_photo.jpg').async('nodebuffer');
    const parsedCleaned = await exifr.parse(cleanedIphoneBuffer, { gps: true, exif: true });
    expect(parsedCleaned?.latitude).toBeUndefined();
    expect(parsedCleaned?.longitude).toBeUndefined();
    expect(parsedCleaned?.Make).toBeUndefined();
  });

  test('Case 4: Security Rejections for Corrupted and Unsupported Formats', async ({ page }) => {
    // 1. Upload unsupported PDF
    await page.locator('input[type="file"]').setInputFiles(path.join(fixturesDir, 'unsupported_file.pdf'));
    await expect(page.locator('text=unsupported format').first()).toBeVisible();
    await expect(page.locator('[role="button"][aria-label^="Inspect metadata for"]')).toHaveCount(0);

    // 2. Upload corrupted header JPEG
    await page.locator('input[type="file"]').setInputFiles(path.join(fixturesDir, 'corrupted_image.jpg'));
    await expect(page.locator('text=unsupported format').first()).toBeVisible();
    await expect(page.locator('[role="button"][aria-label^="Inspect metadata for"]')).toHaveCount(0);
  });

  test('Case 5: Queue Limit Boundary (>20 files)', async ({ page }) => {
    const dt = await page.evaluateHandle(() => {
      const dataTransfer = new DataTransfer();
      for (let i = 0; i < 25; i++) {
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

    // Toast indicates limit and only 20 are added
    await expect(page.locator('text=Only 20 more files can be added')).toBeVisible();
    await expect(page.locator('[role="button"][aria-label^="Inspect metadata for"]')).toHaveCount(20);

    // Clear queue button
    await page.locator('button[aria-label="Clear all files in queue"]').click();
    await expect(page.locator('[role="button"][aria-label^="Inspect metadata for"]')).toHaveCount(0);
  });
});
