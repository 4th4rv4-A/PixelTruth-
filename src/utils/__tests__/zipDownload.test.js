import { describe, it, expect } from 'vitest';
import { deduplicateName } from '../zipDownload';

describe('deduplicateName (imported production function)', () => {
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
    expect(deduplicateName('사진.png', used)).toBe('사진.png');
    expect(deduplicateName('사진.png', used)).toBe('사진-2.png');
    expect(deduplicateName('🌟.webp', used)).toBe('🌟.webp');
    expect(deduplicateName('🌟.webp', used)).toBe('🌟-2.webp');
  });

  it('handles filenames already ending in -2', () => {
    const used = new Set(['photo-2.jpg']);
    expect(deduplicateName('photo-2.jpg', used)).toBe('photo-2-2.jpg');
  });

  it('handles repeated identical names without collision corruption', () => {
    const used = new Set();
    const results = [];
    for (let i = 0; i < 5; i++) {
      results.push(deduplicateName('duplicate.jpg', used));
    }
    expect(results).toEqual([
      'duplicate.jpg',
      'duplicate-2.jpg',
      'duplicate-3.jpg',
      'duplicate-4.jpg',
      'duplicate-5.jpg',
    ]);
  });

  it('does not mutate names of non-colliding files', () => {
    const used = new Set();
    expect(deduplicateName('photo.jpg', used)).toBe('photo.jpg');
    expect(deduplicateName('image.png', used)).toBe('image.png');
    expect(deduplicateName('screenshot.webp', used)).toBe('screenshot.webp');
  });
  it('sanitizes path traversal and weird characters', () => {
    const usedNames = new Set();
    expect(deduplicateName('../../../etc/passwd', usedNames)).toBe('etc_passwd');
    expect(deduplicateName('C:\\Windows\\System32\\cmd.exe', usedNames)).toBe('C__Windows_System32_cmd.exe');
    expect(deduplicateName('a<b\\c.jpg', usedNames)).toBe('a<b_c.jpg');
    expect(deduplicateName('..\\..\\malicious.sh', usedNames)).toBe('malicious.sh');
  });

  it('handles empty names', () => {
    let usedNames = new Set();
    expect(deduplicateName('', usedNames)).toBe('unnamed_file');
    usedNames = new Set();
    expect(deduplicateName('/', usedNames)).toBe('unnamed_file');
  });
});
