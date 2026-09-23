import { describe, it, expect } from 'vitest';
import { validateFile } from '../fileValidator.js';

// Helper to create a fake File object
function createFakeFile(name, size, bytes) {
  const blob = new Blob([bytes]);
  const file = new File([blob], name);
  // Vitest/JSDOM doesn't perfectly mock File.size if we just do new File
  // So we explicitly override property if needed, but new File([blob]) usually works.
  return file;
}

describe('File Intake Security Pipeline', () => {

  it('rejects files exceeding MAX_FILE_SIZE', async () => {
    // Create a mock file with an artificially large size property
    const file = new File([''], 'huge.jpg');
    Object.defineProperty(file, 'size', { value: 60 * 1024 * 1024 });
    
    const result = await validateFile(file);
    expect(result.valid).toBe(false);
    expect(result.reasons).toContain('FILE_TOO_LARGE');
  });

  it('rejects invalid or dangerous filenames', async () => {
    const file = new File([''], 'bad\x00name.jpg');
    const result = await validateFile(file);
    expect(result.valid).toBe(false);
    expect(result.reasons).toContain('INVALID_FILENAME');
  });

  it('rejects files with invalid signatures (e.g. fake executable)', async () => {
    const bytes = new Uint8Array([0x4D, 0x5A, 0x90, 0x00, 0x03, 0x00, 0x00, 0x00, 0x04, 0x00, 0x00, 0x00, 0xFF, 0xFF, 0x00, 0x00]); // MZ header
    const file = createFakeFile('fake.jpg', bytes.length, bytes);
    const result = await validateFile(file);
    expect(result.valid).toBe(false);
    expect(result.reasons).toContain('UNSUPPORTED_FORMAT');
  });

  describe('JPEG Validation', () => {
    it('parses valid JPEG SOF0 to get dimensions', async () => {
      const bytes = new Uint8Array(20);
      let i = 0;
      bytes[i++] = 0xFF; bytes[i++] = 0xD8; // SOI
      bytes[i++] = 0xFF; bytes[i++] = 0xC0; // SOF0
      bytes[i++] = 0x00; bytes[i++] = 0x11; // Length 17
      bytes[i++] = 0x08; // precision
      bytes[i++] = 0x03; bytes[i++] = 0x00; // height = 768
      bytes[i++] = 0x04; bytes[i++] = 0x00; // width = 1024
      
      const file = createFakeFile('test.jpg', bytes.length, bytes);
      const result = await validateFile(file);
      
      expect(result.valid).toBe(true);
      expect(result.format).toBe('jpeg');
      expect(result.width).toBe(1024);
      expect(result.height).toBe(768);
    });

    it('rejects JPEG exceeding pixel limits', async () => {
      const bytes = new Uint8Array(20);
      let i = 0;
      bytes[i++] = 0xFF; bytes[i++] = 0xD8; // SOI
      bytes[i++] = 0xFF; bytes[i++] = 0xC0; // SOF0
      bytes[i++] = 0x00; bytes[i++] = 0x11; // Length
      bytes[i++] = 0x08; // precision
      bytes[i++] = 0x40; bytes[i++] = 0x00; // height = 16384
      bytes[i++] = 0x40; bytes[i++] = 0x00; // width = 16384 (268 MP)
      
      const file = createFakeFile('huge_dims.jpg', bytes.length, bytes);
      const result = await validateFile(file);
      
      expect(result.valid).toBe(false);
      expect(result.reasons).toContain('PIXEL_LIMIT_EXCEEDED');
    });

    it('rejects JPEG with missing dimensions (truncated)', async () => {
      // 16 bytes padded to pass signature check
      const bytes = new Uint8Array([
        0xFF, 0xD8, 0xFF, 0xE1, 0x00, 0x10, 0x00, 0x00, 
        0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00
      ]);
      const file = createFakeFile('trunc.jpg', bytes.length, bytes);
      const result = await validateFile(file);
      
      expect(result.valid).toBe(false);
      expect(result.reasons).toContain('DIMENSIONS_UNKNOWN');
    });
  });

  describe('PNG Validation', () => {
    it('parses valid PNG IHDR to get dimensions', async () => {
      const bytes = new Uint8Array(33);
      let i = 0;
      // signature
      const sig = [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A];
      for (const b of sig) bytes[i++] = b;
      
      // IHDR (len 13)
      bytes[i++] = 0x00; bytes[i++] = 0x00; bytes[i++] = 0x00; bytes[i++] = 0x0D;
      const type = [0x49, 0x48, 0x44, 0x52]; // IHDR
      for (const b of type) bytes[i++] = b;
      
      // width = 800
      bytes[i++] = 0x00; bytes[i++] = 0x00; bytes[i++] = 0x03; bytes[i++] = 0x20;
      // height = 600
      bytes[i++] = 0x00; bytes[i++] = 0x00; bytes[i++] = 0x02; bytes[i++] = 0x58;
      
      const file = createFakeFile('test.png', bytes.length, bytes);
      const result = await validateFile(file);
      
      expect(result.valid).toBe(true);
      expect(result.format).toBe('png');
      expect(result.width).toBe(800);
      expect(result.height).toBe(600);
    });

    it('rejects PNG with malformed chunk length', async () => {
      const bytes = new Uint8Array(24);
      let i = 0;
      // signature
      const sig = [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A];
      for (const b of sig) bytes[i++] = b;
      
      // Negative chunk len
      bytes[i++] = 0xFF; bytes[i++] = 0xFF; bytes[i++] = 0xFF; bytes[i++] = 0xFF;
      
      const file = createFakeFile('bad.png', bytes.length, bytes);
      const result = await validateFile(file);
      
      expect(result.valid).toBe(false);
      expect(result.reasons).toContain('MALFORMED_CONTAINER');
    });
  });

  describe('HEIC Validation', () => {
    it('parses HEIC to find ispe dimensions', async () => {
      // Mock a minimal HEIC container
      const bytes = new Uint8Array(64);
      let i = 0;
      
      // ftyp box (len 16)
      bytes[i++] = 0; bytes[i++] = 0; bytes[i++] = 0; bytes[i++] = 16;
      bytes[i++] = 0x66; bytes[i++] = 0x74; bytes[i++] = 0x79; bytes[i++] = 0x70; // ftyp
      i += 8; // skip payload
      
      // meta box (len 28)
      bytes[i++] = 0; bytes[i++] = 0; bytes[i++] = 0; bytes[i++] = 28;
      bytes[i++] = 0x6D; bytes[i++] = 0x65; bytes[i++] = 0x74; bytes[i++] = 0x61; // meta
      i += 4; // version/flags
      
      // ispe box inside meta (len 16)
      bytes[i++] = 0; bytes[i++] = 0; bytes[i++] = 0; bytes[i++] = 16;
      bytes[i++] = 0x69; bytes[i++] = 0x73; bytes[i++] = 0x70; bytes[i++] = 0x65; // ispe
      i += 4; // version/flags
      // width = 500
      bytes[i++] = 0; bytes[i++] = 0; bytes[i++] = 1; bytes[i++] = 0xF4;
      // height = 400
      bytes[i++] = 0; bytes[i++] = 0; bytes[i++] = 1; bytes[i++] = 0x90;
      
      const file = createFakeFile('test.heic', bytes.length, bytes);
      const result = await validateFile(file);
      
      expect(result.valid).toBe(true);
      expect(result.format).toBe('heic');
      expect(result.width).toBe(500);
      expect(result.height).toBe(400);
    });
  });
});
