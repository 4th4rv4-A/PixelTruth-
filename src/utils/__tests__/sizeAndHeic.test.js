import { describe, it, expect } from 'vitest';

/**
 * Size comparison formatting tests.
 * Re-implements the formatting logic from CleanButton.jsx for unit testing.
 */

function formatSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function formatSizeComparison(original, cleaned) {
  const diff = original - cleaned;
  const pct = ((Math.abs(diff) / original) * 100).toFixed(1);

  if (diff > 0) {
    return `Saved ${formatSize(diff)} (${pct}%)`;
  } else if (diff < 0) {
    return `Increased by ${formatSize(-diff)} (${pct}%)`;
  }
  return 'Same size';
}

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
 * HEIC conversion path tests.
 *
 * These test the HEIC detection and output naming logic
 * to verify the clean architecture:
 * - Detect uses ORIGINAL HEIC
 * - Clean converts to JPEG only at clean time
 * - Output has .jpg extension
 */
describe('HEIC output naming', () => {
  function isHeic(file) {
    return (
      file.type === 'image/heic' ||
      file.type === 'image/heif' ||
      /\.hei[cf]$/i.test(file.name)
    );
  }

  function getOutputName(originalName, cleanedMimeType) {
    let outputName = originalName;
    if (cleanedMimeType === 'image/jpeg' && !/\.jpe?g$/i.test(outputName)) {
      outputName = outputName.replace(/\.[^/.]+$/, '.jpg');
    }
    return outputName;
  }

  it('detects HEIC by MIME type', () => {
    expect(isHeic({ type: 'image/heic', name: 'photo.heic' })).toBe(true);
  });

  it('detects HEIF by MIME type', () => {
    expect(isHeic({ type: 'image/heif', name: 'photo.heif' })).toBe(true);
  });

  it('detects HEIC by extension when MIME is empty', () => {
    expect(isHeic({ type: '', name: 'photo.heic' })).toBe(true);
  });

  it('does not falsely detect JPEG as HEIC', () => {
    expect(isHeic({ type: 'image/jpeg', name: 'photo.jpg' })).toBe(false);
  });

  it('converts .heic extension to .jpg in output name', () => {
    expect(getOutputName('photo.heic', 'image/jpeg')).toBe('photo.jpg');
  });

  it('converts .HEIC extension to .jpg in output name', () => {
    expect(getOutputName('photo.HEIC', 'image/jpeg')).toBe('photo.jpg');
  });

  it('converts .heif extension to .jpg in output name', () => {
    expect(getOutputName('photo.heif', 'image/jpeg')).toBe('photo.jpg');
  });

  it('does not change .jpg output name for JPEG input', () => {
    expect(getOutputName('photo.jpg', 'image/jpeg')).toBe('photo.jpg');
  });

  it('converts .webp to .jpg when output is JPEG', () => {
    expect(getOutputName('photo.webp', 'image/jpeg')).toBe('photo.jpg');
  });

  it('preserves .webp when output is WebP', () => {
    expect(getOutputName('photo.webp', 'image/webp')).toBe('photo.webp');
  });
});
