import { describe, it, expect } from 'vitest';
import {
  formatSize,
  formatSizeComparison,
  calculateSizeChange,
} from '../sizeUtils';
import {
  isHeic,
  getOutputFilename,
  resolveOutputExtension,
} from '../filenameUtils';

/**
 * Size comparison formatting tests using imported production sizeUtils.
 */
describe('formatSize', () => {
  it('formats bytes', () => {
    expect(formatSize(512)).toBe('512 B');
  });

  it('formats kilobytes', () => {
    expect(formatSize(2048)).toBe('2.0 KB');
  });

  it('formats megabytes', () => {
    expect(formatSize(5 * 1024 * 1024)).toBe('5.00 MB');
  });
});

describe('calculateSizeChange', () => {
  it('correctly reports size savings', () => {
    const change = calculateSizeChange(1000, 800);
    expect(change.diff).toBe(200);
    expect(change.pct).toBe('20.0');
    expect(change.isSaved).toBe(true);
    expect(change.isIncreased).toBe(false);
  });

  it('correctly reports size increases', () => {
    const change = calculateSizeChange(1000, 1200);
    expect(change.diff).toBe(-200);
    expect(change.pct).toBe('20.0');
    expect(change.isSaved).toBe(false);
    expect(change.isIncreased).toBe(true);
  });

  it('handles zero original size safely without division by zero', () => {
    const change = calculateSizeChange(0, 500);
    expect(change.pct).toBe('0.0');
  });
});

describe('formatSizeComparison', () => {
  it('shows savings when cleaned file is smaller', () => {
    const original = 5 * 1024 * 1024; // 5MB
    const cleaned = 4.5 * 1024 * 1024; // 4.5MB
    const result = formatSizeComparison(original, cleaned);
    expect(result).toContain('Saved');
    expect(result).toContain('10.0%');
  });

  it('shows increase when cleaned file is larger', () => {
    const original = 2 * 1024 * 1024; // 2MB
    const cleaned = 2.2 * 1024 * 1024; // 2.2MB
    const result = formatSizeComparison(original, cleaned);
    expect(result).toContain('Increased by');
    expect(result).not.toContain('Saved');
  });

  it('shows "Same size" when sizes are equal', () => {
    const size = 3 * 1024 * 1024;
    expect(formatSizeComparison(size, size)).toBe('Same size');
  });

  it('never calls an increase a "saving"', () => {
    const original = 1024;
    const cleaned = 2048;
    const result = formatSizeComparison(original, cleaned);
    expect(result).not.toContain('Saved');
    expect(result).toContain('Increased by');
  });
});

/**
 * MIME to extension resolution tests using imported production filenameUtils.
 */
describe('resolveOutputExtension', () => {
  it('maps image/jpeg to .jpg', () => {
    expect(resolveOutputExtension('image/jpeg')).toBe('.jpg');
  });

  it('maps image/png to .png', () => {
    expect(resolveOutputExtension('image/png')).toBe('.png');
  });

  it('maps image/webp to .webp', () => {
    expect(resolveOutputExtension('image/webp')).toBe('.webp');
  });

  it('throws error for unknown or unsupported MIME types', () => {
    expect(() => resolveOutputExtension('image/gif')).toThrow(/Unsupported output format/);
    expect(() => resolveOutputExtension('application/pdf')).toThrow(/Unsupported output format/);
    expect(() => resolveOutputExtension('')).toThrow(/Invalid or missing MIME type/);
    expect(() => resolveOutputExtension(null)).toThrow(/Invalid or missing MIME type/);
  });
});

/**
 * Output filename formatting tests using imported production filenameUtils.
 */
describe('getOutputFilename', () => {
  it('converts .heic extension to .jpg when output is JPEG', () => {
    expect(getOutputFilename('photo.heic', 'image/jpeg')).toBe('photo.jpg');
  });

  it('converts .HEIC extension to .jpg when output is JPEG', () => {
    expect(getOutputFilename('photo.HEIC', 'image/jpeg')).toBe('photo.jpg');
  });

  it('converts .heif extension to .jpg when output is JPEG', () => {
    expect(getOutputFilename('photo.heif', 'image/jpeg')).toBe('photo.jpg');
  });

  it('preserves .jpg output name for JPEG input', () => {
    expect(getOutputFilename('photo.jpg', 'image/jpeg')).toBe('photo.jpg');
  });

  it('normalizes .jpeg input to .jpg output', () => {
    expect(getOutputFilename('photo.jpeg', 'image/jpeg')).toBe('photo.jpg');
  });

  it('converts .webp to .jpg when output is JPEG', () => {
    expect(getOutputFilename('photo.webp', 'image/jpeg')).toBe('photo.jpg');
  });

  it('preserves .webp when output is WebP', () => {
    expect(getOutputFilename('photo.webp', 'image/webp')).toBe('photo.webp');
  });

  it('handles filename with no extension by appending correct extension', () => {
    expect(getOutputFilename('unnamed_photo', 'image/jpeg')).toBe('unnamed_photo.jpg');
    expect(getOutputFilename('unnamed_photo', 'image/png')).toBe('unnamed_photo.png');
    expect(getOutputFilename('unnamed_photo', 'image/webp')).toBe('unnamed_photo.webp');
  });

  it('handles filenames with multiple dots', () => {
    expect(getOutputFilename('my.holiday.photo.2024.heic', 'image/jpeg')).toBe('my.holiday.photo.2024.jpg');
  });

  it('throws on unsupported output MIME type to prevent corrupted file naming', () => {
    expect(() => getOutputFilename('photo.jpg', 'image/tiff')).toThrow();
  });
});

/**
 * HEIC detection tests using imported production filenameUtils.
 */
describe('isHeic', () => {
  it('detects HEIC by MIME type', () => {
    expect(isHeic({ type: 'image/heic', name: 'photo.heic' })).toBe(true);
  });

  it('detects HEIF by MIME type', () => {
    expect(isHeic({ type: 'image/heif', name: 'photo.heif' })).toBe(true);
  });

  it('detects HEIC by extension when MIME is empty', () => {
    expect(isHeic({ type: '', name: 'photo.heic' })).toBe(true);
  });

  it('detects HEIF by extension when MIME is empty', () => {
    expect(isHeic({ type: '', name: 'photo.heif' })).toBe(true);
  });

  it('does not falsely detect JPEG as HEIC', () => {
    expect(isHeic({ type: 'image/jpeg', name: 'photo.jpg' })).toBe(false);
  });

  it('does not falsely detect PNG or WebP as HEIC', () => {
    expect(isHeic({ type: 'image/png', name: 'image.png' })).toBe(false);
    expect(isHeic({ type: 'image/webp', name: 'image.webp' })).toBe(false);
  });

  it('handles null or empty file safely', () => {
    expect(isHeic(null)).toBe(false);
    expect(isHeic({})).toBe(false);
  });
});
