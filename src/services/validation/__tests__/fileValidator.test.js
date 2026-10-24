import { describe, it, expect } from 'vitest';
import { validateHeaderSafety } from '../fileValidator.js';

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
    
    const result = await validateHeaderSafety(file);
    expect(result.valid).toBe(false);
    expect(result.reasons).toContain('FILE_TOO_LARGE');
  });

  it('rejects invalid or dangerous filenames', async () => {
    const file = new File([''], 'bad\x00name.jpg');
    const result = await validateHeaderSafety(file);
    expect(result.valid).toBe(false);
    expect(result.reasons).toContain('INVALID_FILENAME');
  });

  it('rejects files with invalid signatures (e.g. fake executable)', async () => {
    const bytes = new Uint8Array([0x4D, 0x5A, 0x90, 0x00, 0x03, 0x00, 0x00, 0x00, 0x04, 0x00, 0x00, 0x00, 0xFF, 0xFF, 0x00, 0x00]); // MZ header
    const file = createFakeFile('fake.jpg', bytes.length, bytes);
    const result = await validateHeaderSafety(file);
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
      const result = await validateHeaderSafety(file);
      
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
      const result = await validateHeaderSafety(file);
      
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
      const result = await validateHeaderSafety(file);
      
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
      const result = await validateHeaderSafety(file);
      
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
      const result = await validateHeaderSafety(file);
      
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
      const result = await validateHeaderSafety(file);
      
      expect(result.valid).toBe(true);
      expect(result.format).toBe('heic');
      expect(result.width).toBe(500);
      expect(result.height).toBe(400);
    });
  });

  describe('GIF Validation', () => {
    it('parses valid GIF89a logical screen descriptor to get dimensions', async () => {
      const bytes = new Uint8Array(16);
      const sig = [0x47, 0x49, 0x46, 0x38, 0x39, 0x61];
      for (let i = 0; i < sig.length; i++) bytes[i] = sig[i];
      // width = 640 (0x0280 -> bytes 6, 7: 0x80, 0x02 little-endian)
      bytes[6] = 0x80;
      bytes[7] = 0x02;
      // height = 480 (0x01E0 -> bytes 8, 9: 0xE0, 0x01 little-endian)
      bytes[8] = 0xE0;
      bytes[9] = 0x01;

      const file = createFakeFile('test.gif', bytes.length, bytes);
      const result = await validateHeaderSafety(file);

      expect(result.valid).toBe(true);
      expect(result.format).toBe('gif');
      expect(result.mime).toBe('image/gif');
      expect(result.width).toBe(640);
      expect(result.height).toBe(480);
    });

    it('parses valid GIF87a logical screen descriptor', async () => {
      const bytes = new Uint8Array(16);
      const sig = [0x47, 0x49, 0x46, 0x38, 0x37, 0x61];
      for (let i = 0; i < sig.length; i++) bytes[i] = sig[i];
      // width = 320 (0x0140 -> 0x40, 0x01)
      bytes[6] = 0x40;
      bytes[7] = 0x01;
      // height = 240 (0x00F0 -> 0xF0, 0x00)
      bytes[8] = 0xF0;
      bytes[9] = 0x00;

      const file = createFakeFile('test87.gif', bytes.length, bytes);
      const result = await validateHeaderSafety(file);

      expect(result.valid).toBe(true);
      expect(result.format).toBe('gif');
      expect(result.width).toBe(320);
      expect(result.height).toBe(240);
    });

    it('rejects GIF with missing dimensions (zero width/height)', async () => {
      // 16 bytes to pass signature check, but width and height are 0
      const bytes = new Uint8Array([
        0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 0x00, 0x00,
        0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00
      ]);
      const file = createFakeFile('empty_dim.gif', bytes.length, bytes);
      const result = await validateHeaderSafety(file);

      expect(result.valid).toBe(false);
      expect(result.reasons).toContain('DIMENSIONS_UNKNOWN');
    });
  });

  describe('AVIF Validation', () => {
    it('parses AVIF with majorBrand avif to find ispe dimensions', async () => {
      const bytes = new Uint8Array(64);
      let i = 0;

      // ftyp box (len 16, brand 'avif')
      bytes[i++] = 0; bytes[i++] = 0; bytes[i++] = 0; bytes[i++] = 16;
      bytes[i++] = 0x66; bytes[i++] = 0x74; bytes[i++] = 0x79; bytes[i++] = 0x70; // ftyp
      bytes[i++] = 0x61; bytes[i++] = 0x76; bytes[i++] = 0x69; bytes[i++] = 0x66; // avif
      i += 4; // minor_version

      // meta box (len 28)
      bytes[i++] = 0; bytes[i++] = 0; bytes[i++] = 0; bytes[i++] = 28;
      bytes[i++] = 0x6D; bytes[i++] = 0x65; bytes[i++] = 0x74; bytes[i++] = 0x61; // meta
      i += 4; // version/flags

      // ispe box inside meta (len 16)
      bytes[i++] = 0; bytes[i++] = 0; bytes[i++] = 0; bytes[i++] = 16;
      bytes[i++] = 0x69; bytes[i++] = 0x73; bytes[i++] = 0x70; bytes[i++] = 0x65; // ispe
      i += 4; // version/flags
      // width = 1920 (0x00000780)
      bytes[i++] = 0; bytes[i++] = 0; bytes[i++] = 0x07; bytes[i++] = 0x80;
      // height = 1080 (0x00000438)
      bytes[i++] = 0; bytes[i++] = 0; bytes[i++] = 0x04; bytes[i++] = 0x38;

      const file = createFakeFile('test.avif', bytes.length, bytes);
      const result = await validateHeaderSafety(file);

      expect(result.valid).toBe(true);
      expect(result.format).toBe('avif');
      expect(result.mime).toBe('image/avif');
      expect(result.width).toBe(1920);
      expect(result.height).toBe(1080);
    });

    it('parses AVIF with compatible brand avif', async () => {
      const bytes = new Uint8Array(68);
      let i = 0;

      // ftyp box (len 20, majorBrand 'mif1', compatible brand 'avif')
      bytes[i++] = 0; bytes[i++] = 0; bytes[i++] = 0; bytes[i++] = 20;
      bytes[i++] = 0x66; bytes[i++] = 0x74; bytes[i++] = 0x79; bytes[i++] = 0x70; // ftyp
      bytes[i++] = 0x6D; bytes[i++] = 0x69; bytes[i++] = 0x66; bytes[i++] = 0x31; // mif1
      i += 4; // minor_version
      bytes[i++] = 0x61; bytes[i++] = 0x76; bytes[i++] = 0x69; bytes[i++] = 0x66; // avif compatible brand

      // meta box (len 28)
      bytes[i++] = 0; bytes[i++] = 0; bytes[i++] = 0; bytes[i++] = 28;
      bytes[i++] = 0x6D; bytes[i++] = 0x65; bytes[i++] = 0x74; bytes[i++] = 0x61; // meta
      i += 4; // version/flags

      // ispe box inside meta (len 16)
      bytes[i++] = 0; bytes[i++] = 0; bytes[i++] = 0; bytes[i++] = 16;
      bytes[i++] = 0x69; bytes[i++] = 0x73; bytes[i++] = 0x70; bytes[i++] = 0x65; // ispe
      i += 4; // version/flags
      // width = 800
      bytes[i++] = 0; bytes[i++] = 0; bytes[i++] = 0x03; bytes[i++] = 0x20;
      // height = 600
      bytes[i++] = 0; bytes[i++] = 0; bytes[i++] = 0x02; bytes[i++] = 0x58;

      const file = createFakeFile('compatible.avif', bytes.length, bytes);
      const result = await validateHeaderSafety(file);

      expect(result.valid).toBe(true);
      expect(result.format).toBe('avif');
      expect(result.mime).toBe('image/avif');
      expect(result.width).toBe(800);
      expect(result.height).toBe(600);
    });
  });

  describe('WebP Validation & Bounds Checking', () => {
    it('parses valid WebP VP8X chunk for canvas dimensions', async () => {
      const bytes = new Uint8Array(32);
      let i = 0;
      // 'RIFF' + len + 'WEBP'
      bytes[i++] = 0x52; bytes[i++] = 0x49; bytes[i++] = 0x46; bytes[i++] = 0x46;
      bytes[i++] = 24; bytes[i++] = 0; bytes[i++] = 0; bytes[i++] = 0;
      bytes[i++] = 0x57; bytes[i++] = 0x45; bytes[i++] = 0x42; bytes[i++] = 0x50;

      // 'VP8X' + len 10
      bytes[i++] = 0x56; bytes[i++] = 0x50; bytes[i++] = 0x38; bytes[i++] = 0x58;
      bytes[i++] = 10; bytes[i++] = 0; bytes[i++] = 0; bytes[i++] = 0;
      // Flags (4 bytes)
      i += 4;
      // Width - 1 = 799 (0x031F -> 0x1F, 0x03, 0x00)
      bytes[i++] = 0x1F; bytes[i++] = 0x03; bytes[i++] = 0x00;
      // Height - 1 = 599 (0x0257 -> 0x57, 0x02, 0x00)
      bytes[i++] = 0x57; bytes[i++] = 0x02; bytes[i++] = 0x00;

      const file = createFakeFile('test.webp', bytes.length, bytes);
      const result = await validateHeaderSafety(file);

      expect(result.valid).toBe(true);
      expect(result.format).toBe('webp');
      expect(result.width).toBe(800);
      expect(result.height).toBe(600);
    });

    it('rejects truncated VP8X chunk where canvas dimensions cannot be fully read', async () => {
      // Array truncated before height bytes are present (length 26)
      const bytes = new Uint8Array(26);
      let i = 0;
      bytes[i++] = 0x52; bytes[i++] = 0x49; bytes[i++] = 0x46; bytes[i++] = 0x46;
      bytes[i++] = 18; bytes[i++] = 0; bytes[i++] = 0; bytes[i++] = 0;
      bytes[i++] = 0x57; bytes[i++] = 0x45; bytes[i++] = 0x42; bytes[i++] = 0x50;

      bytes[i++] = 0x56; bytes[i++] = 0x50; bytes[i++] = 0x38; bytes[i++] = 0x58;
      bytes[i++] = 10; bytes[i++] = 0; bytes[i++] = 0; bytes[i++] = 0;
      // Flags (4 bytes)
      i += 4;
      // Truncated here: only width bytes present, height missing
      bytes[i++] = 0x1F; bytes[i++] = 0x03;

      const file = createFakeFile('truncated_vp8x.webp', bytes.length, bytes);
      const result = await validateHeaderSafety(file);

      expect(result.valid).toBe(false);
      expect(result.reasons).toContain('MALFORMED_CONTAINER');
    });
  });

  describe('BMFF 64-bit Box Length Handling', () => {
    it('correctly handles 64-bit extended box size in BMFF container', async () => {
      const bytes = new Uint8Array(80);
      let i = 0;

      // ftyp box with 64-bit length (size field = 1, followed by 8-byte length = 24)
      bytes[i++] = 0; bytes[i++] = 0; bytes[i++] = 0; bytes[i++] = 1; // 64-bit indicator
      bytes[i++] = 0x66; bytes[i++] = 0x74; bytes[i++] = 0x79; bytes[i++] = 0x70; // 'ftyp'
      // 8 bytes extended size (high 32 bits = 0, low 32 bits = 24)
      bytes[i++] = 0; bytes[i++] = 0; bytes[i++] = 0; bytes[i++] = 0;
      bytes[i++] = 0; bytes[i++] = 0; bytes[i++] = 0; bytes[i++] = 24;
      // ftyp payload (8 bytes: major brand 'avif', minor 0)
      bytes[i++] = 0x61; bytes[i++] = 0x76; bytes[i++] = 0x69; bytes[i++] = 0x66;
      bytes[i++] = 0; bytes[i++] = 0; bytes[i++] = 0; bytes[i++] = 0;

      // meta box (len 28)
      bytes[i++] = 0; bytes[i++] = 0; bytes[i++] = 0; bytes[i++] = 28;
      bytes[i++] = 0x6D; bytes[i++] = 0x65; bytes[i++] = 0x74; bytes[i++] = 0x61;
      i += 4; // version/flags

      // ispe box inside meta (len 16)
      bytes[i++] = 0; bytes[i++] = 0; bytes[i++] = 0; bytes[i++] = 16;
      bytes[i++] = 0x69; bytes[i++] = 0x73; bytes[i++] = 0x70; bytes[i++] = 0x65;
      i += 4; // version/flags
      // width = 1024 (0x00000400)
      bytes[i++] = 0; bytes[i++] = 0; bytes[i++] = 0x04; bytes[i++] = 0x00;
      // height = 768 (0x00000300)
      bytes[i++] = 0; bytes[i++] = 0; bytes[i++] = 0x03; bytes[i++] = 0x00;

      const file = createFakeFile('test_64bit.avif', bytes.length, bytes);
      const result = await validateHeaderSafety(file);

      expect(result.valid).toBe(true);
      expect(result.format).toBe('avif');
      expect(result.width).toBe(1024);
      expect(result.height).toBe(768);
    });
  });
});
