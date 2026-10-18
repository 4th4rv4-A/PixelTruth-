import { test, expect } from '@playwright/test';
import path from 'path';

const fixturesDir = path.resolve(process.cwd(), 'tests', 'fixtures', 'realistic');

test.describe('Interactive GPS Privacy Radar', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('displays tactical radar HUD, coordinates, and telemetry on GPS-tagged image', async ({ page }) => {
    const iphonePath = path.join(fixturesDir, 'iphone_gps_photo.jpg');
    await page.locator('input[type="file"]').setInputFiles(iphonePath);

    // Wait for file in queue
    await expect(page.locator('text=iphone_gps_photo.jpg').first()).toBeVisible();

    // Verify GPS Privacy Radar container is rendered
    const radar = page.locator('[data-testid="gps-privacy-radar"]');
    await expect(radar).toBeVisible();

    // Verify title and critical risk badge
    await expect(radar.locator('text=GPS Privacy Radar')).toBeVisible();
    await expect(radar.locator('text=CRITICAL PRIVACY RISK')).toBeVisible();

    // Verify coordinate telemetry
    await expect(radar.locator("text=37° 46' 30.0\" N, 122° 25' 10.0\" W")).toBeVisible();
    await expect(radar.locator('text=37.775000, -122.419444')).toBeVisible();

    // Verify altitude
    await expect(radar.locator('text=15.0 m (49 ft)').first()).toBeVisible();

    // Verify external map provider links
    const googleLink = radar.locator('a[title="Open in Google Maps"]');
    await expect(googleLink).toBeVisible();
    await expect(googleLink).toHaveAttribute('href', /google\.com\/maps\?q=37\.775000,-122\.419444/);

    const appleLink = radar.locator('a[title="Open in Apple Maps"]');
    await expect(appleLink).toBeVisible();
    await expect(appleLink).toHaveAttribute('href', /maps\.apple\.com\/\?q=37\.775000,-122\.419444/);

    const osmLink = radar.locator('a[title="Open in OpenStreetMap"]');
    await expect(osmLink).toBeVisible();
    await expect(osmLink).toHaveAttribute('href', /openstreetmap\.org/);
  });

  test('toggles interactive OpenStreetMap preview on-demand', async ({ page }) => {
    const iphonePath = path.join(fixturesDir, 'iphone_gps_photo.jpg');
    await page.locator('input[type="file"]').setInputFiles(iphonePath);

    const radar = page.locator('[data-testid="gps-privacy-radar"]');
    await expect(radar).toBeVisible();

    // Initially, iframe is not present
    await expect(radar.locator('iframe')).toHaveCount(0);

    // Click "Show Street Map Preview"
    await radar.locator('button:has-text("Show Street Map Preview")').click();

    // Verify iframe with OpenStreetMap embed is visible
    const iframe = radar.locator('iframe[title="OpenStreetMap Location Preview"]');
    await expect(iframe).toBeVisible();
    await expect(iframe).toHaveAttribute('src', /openstreetmap\.org\/export\/embed\.html/);

    // Verify privacy notice is displayed
    await expect(radar.locator('text=100% Client-Side Privacy: Map preview loaded on-demand')).toBeVisible();

    // Click "Hide Street Map" to close
    await radar.locator('button:has-text("Hide Street Map")').click();
    await expect(radar.locator('iframe')).toHaveCount(0);
  });

  test('allows toggling between Exposed and Redacted preview before cleaning', async ({ page }) => {
    const iphonePath = path.join(fixturesDir, 'iphone_gps_photo.jpg');
    await page.locator('input[type="file"]').setInputFiles(iphonePath);

    const radar = page.locator('[data-testid="gps-privacy-radar"]');
    await expect(radar).toBeVisible();

    // Click "Redacted (After)" preview toggle
    await radar.locator('button:has-text("Redacted (After)")').click();

    // Verify Redacted indicators
    await expect(radar.locator('text=0 BYTES LEAKED')).toBeVisible();
    await expect(radar.locator('text=Location Data Redacted & Purged')).toBeVisible();
    await expect(radar.locator('text=PAYLOAD PURGED')).toBeVisible();

    // Verify coordinates are redacted
    await expect(radar.locator('text=████° ██\' ██" N, ███° ██\' ██" W')).toBeVisible();
    await expect(radar.locator('text=Zero location telemetry remaining')).toBeVisible();

    // Toggle back to "Exposed (Before)"
    await radar.locator('button:has-text("Exposed (Before)")').click();
    await expect(radar.locator('text=CRITICAL PRIVACY RISK')).toBeVisible();
    await expect(radar.locator('text=37.775000, -122.419444')).toBeVisible();
  });

  test('automatically transitions to Redacted state when image is cleaned', async ({ page }) => {
    const iphonePath = path.join(fixturesDir, 'iphone_gps_photo.jpg');
    await page.locator('input[type="file"]').setInputFiles(iphonePath);

    const radar = page.locator('[data-testid="gps-privacy-radar"]');
    await expect(radar).toBeVisible();
    await expect(radar.locator('text=CRITICAL PRIVACY RISK')).toBeVisible();

    // Click REMOVE EXIF
    const removeExifBtn = page.locator('.frame button:has-text("REMOVE EXIF")').last();
    await removeExifBtn.click();

    // Wait for clean completion
    await expect(page.locator('button[aria-label="Save cleaned iphone_gps_photo.jpg"]')).toBeVisible({ timeout: 10000 });

    // Radar automatically reflects the cleaned & redacted state
    await expect(radar.locator('text=0 BYTES LEAKED')).toBeVisible();
    await expect(radar.locator('text=PAYLOAD PURGED')).toBeVisible();
    await expect(radar.locator('text=Zero location telemetry remaining')).toBeVisible();
  });
});
