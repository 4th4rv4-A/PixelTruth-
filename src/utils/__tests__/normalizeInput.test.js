import { describe, it, expect } from 'vitest';
import { inspectDimensions, MAX_PIXELS } from '../normalizeInput';

/**
 * Dimension safety tests.
 *
 * Note: These tests mock exifr.parse because we can't create real EXIF data
 * in a unit test without a real image file. The tests verify the decision logic
 * applied to the parsed metadata results.
 */

// We need to mock browser-dependent modules
import { vi } from 'vitest';

vi.mock('heic2any', () => ({
  default: vi.fn(),
}));

vi.mock('exifr', () => ({
  default: {
    parse: vi.fn(),
  },
}));

import exifr from 'exifr';

describe('inspectDimensions', () => {
  const makeFile = (size = 1024, name = 'test.jpg') => ({
    name,
    size,
    type: 'image/jpeg',
  });

  it('returns safe when dimensions are within limit', async () => {
    exifr.parse.mockResolvedValue({ ImageWidth: 4000, ImageHeight: 3000 });
    const result = await inspectDimensions(makeFile());
    expect(result.safe).toBe(true);
  });

  it('returns unsafe with reason "oversized" when pixels exceed MAX_PIXELS', async () => {
    // 10000 * 10000 = 100M pixels > 64M (MAX_PIXELS)
    exifr.parse.mockResolvedValue({ ImageWidth: 10000, ImageHeight: 10000 });
    const result = await inspectDimensions(makeFile());
    expect(result.safe).toBe(false);
    expect(result.reason).toBe('oversized');
  });

  it('uses conservative file size fallback when metadata has no dimensions (small file)', async () => {
    exifr.parse.mockResolvedValue({ Make: 'Apple' }); // metadata exists but no dimensions
    const result = await inspectDimensions(makeFile(5 * 1024 * 1024)); // 5MB
    expect(result.safe).toBe(true);
    expect(result.reason).toBe('size-fallback');
  });

  it('rejects large file when metadata has no dimensions', async () => {
    exifr.parse.mockResolvedValue({ Make: 'Apple' }); // no dimensions
    const result = await inspectDimensions(makeFile(20 * 1024 * 1024)); // 20MB
    expect(result.safe).toBe(false);
    expect(result.reason).toBe('unverifiable');
  });

  it('uses conservative fallback when metadata is null (small file)', async () => {
    exifr.parse.mockResolvedValue(null);
    const result = await inspectDimensions(makeFile(1024));
    expect(result.safe).toBe(true);
    expect(result.reason).toBe('size-fallback');
  });

  it('rejects when metadata is null and file is large', async () => {
    exifr.parse.mockResolvedValue(null);
    const result = await inspectDimensions(makeFile(20 * 1024 * 1024));
    expect(result.safe).toBe(false);
    expect(result.reason).toBe('unverifiable');
  });

  it('uses conservative fallback when parse throws (small file)', async () => {
    exifr.parse.mockRejectedValue(new Error('parse failed'));
    const result = await inspectDimensions(makeFile(1024));
    expect(result.safe).toBe(true);
    expect(result.reason).toBe('size-fallback');
  });

  it('rejects when parse throws and file is large', async () => {
    exifr.parse.mockRejectedValue(new Error('parse failed'));
    const result = await inspectDimensions(makeFile(20 * 1024 * 1024));
    expect(result.safe).toBe(false);
    expect(result.reason).toBe('unverifiable');
  });

  it('checks boundary at exactly 15MB for fallback', async () => {
    exifr.parse.mockResolvedValue(null);
    const exactly15MB = 15 * 1024 * 1024;
    const result = await inspectDimensions(makeFile(exactly15MB));
    expect(result.safe).toBe(true);
    expect(result.reason).toBe('size-fallback');
  });

  it('rejects at 15MB + 1 byte for fallback', async () => {
    exifr.parse.mockResolvedValue(null);
    const just_over_15MB = 15 * 1024 * 1024 + 1;
    const result = await inspectDimensions(makeFile(just_over_15MB));
    expect(result.safe).toBe(false);
    expect(result.reason).toBe('unverifiable');
  });

  it('uses PixelXDimension and PixelYDimension as fallback dimension fields', async () => {
    exifr.parse.mockResolvedValue({ PixelXDimension: 1000, PixelYDimension: 1000 });
    const result = await inspectDimensions(makeFile());
    expect(result.safe).toBe(true);
  });

  it('uses ExifImageWidth and ExifImageHeight as fallback dimension fields', async () => {
    exifr.parse.mockResolvedValue({ ExifImageWidth: 1000, ExifImageHeight: 1000 });
    const result = await inspectDimensions(makeFile());
    expect(result.safe).toBe(true);
  });
});

describe('MAX_PIXELS constant', () => {
  it('equals 64 megapixels', () => {
    expect(MAX_PIXELS).toBe(64 * 1024 * 1024);
  });
});
