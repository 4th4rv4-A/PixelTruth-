import { describe, it, expect } from 'vitest';

/**
 * Tests for the filename deduplication logic used in zipDownload.js.
 * We re-implement the pure function here to test without JSZip dependency.
 */
function deduplicateName(name, usedNames) {
  if (!usedNames.has(name)) {
    usedNames.add(name);
    return name;
  }

  const dotIndex = name.lastIndexOf('.');
  const base = dotIndex !== -1 ? name.slice(0, dotIndex) : name;
  const ext = dotIndex !== -1 ? name.slice(dotIndex) : '';

  let counter = 2;
  let candidate = `${base}-${counter}${ext}`;
  while (usedNames.has(candidate)) {
    counter++;
    candidate = `${base}-${counter}${ext}`;
  }

  usedNames.add(candidate);
  return candidate;
}

describe('deduplicateName', () => {
  it('returns original name when no collision', () => {
    const used = new Set();
    expect(deduplicateName('photo.jpg', used)).toBe('photo.jpg');
  });

  it('appends -2 on first collision', () => {
    const used = new Set(['photo.jpg']);
    expect(deduplicateName('photo.jpg', used)).toBe('photo-2.jpg');
  });

  it('appends -3 when -2 is also taken', () => {
    const used = new Set(['photo.jpg', 'photo-2.jpg']);
    expect(deduplicateName('photo.jpg', used)).toBe('photo-3.jpg');
  });

  it('handles files without extensions', () => {
    const used = new Set(['image']);
    expect(deduplicateName('image', used)).toBe('image-2');
  });

  it('handles the WebP → JPEG collision case', () => {
    const used = new Set();
    // First file: photo.webp → converted to photo.jpg
    expect(deduplicateName('photo.jpg', used)).toBe('photo.jpg');
    // Second file: photo.jpg (original JPEG)
    expect(deduplicateName('photo.jpg', used)).toBe('photo-2.jpg');
  });

  it('handles multiple collisions in sequence', () => {
    const used = new Set();
    expect(deduplicateName('photo.jpg', used)).toBe('photo.jpg');
    expect(deduplicateName('photo.jpg', used)).toBe('photo-2.jpg');
    expect(deduplicateName('photo.jpg', used)).toBe('photo-3.jpg');
    expect(deduplicateName('photo.jpg', used)).toBe('photo-4.jpg');
  });

  it('handles filenames with multiple dots', () => {
    const used = new Set(['my.vacation.photo.jpg']);
    expect(deduplicateName('my.vacation.photo.jpg', used)).toBe('my.vacation.photo-2.jpg');
  });

  it('handles unicode filenames', () => {
    const used = new Set(['写真.jpg']);
    expect(deduplicateName('写真.jpg', used)).toBe('写真-2.jpg');
  });

  it('handles filenames already ending in -2', () => {
    const used = new Set(['photo-2.jpg']);
    // A different file that happens to be named photo-2.jpg
    expect(deduplicateName('photo-2.jpg', used)).toBe('photo-2-2.jpg');
  });

  it('does not mutate names of non-colliding files', () => {
    const used = new Set();
    expect(deduplicateName('photo.jpg', used)).toBe('photo.jpg');
    expect(deduplicateName('image.png', used)).toBe('image.png');
    expect(deduplicateName('screenshot.webp', used)).toBe('screenshot.webp');
  });
});
