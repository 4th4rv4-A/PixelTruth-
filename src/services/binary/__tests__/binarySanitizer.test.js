import { describe, it, expect } from 'vitest';
import { sanitizeJpeg } from '../jpegCarver.js';
import { sanitizePng } from '../pngCarver.js';
import { sanitizeWebp } from '../webpCarver.js';
import { sanitizeImage } from '../index.js';

// --- Mocks ---

function createMockJpeg() {
  // SOI (2) + APP1 (Exif) (16) + SOS (2) + Data (4) + EOI (2) = 26 bytes
  const bytes = new Uint8Array(26);
  let i = 0;
  // SOI
  bytes[i++] = 0xFF; bytes[i++] = 0xD8;
  
  // APP1
  bytes[i++] = 0xFF; bytes[i++] = 0xE1;
  bytes[i++] = 0x00; bytes[i++] = 0x0C; // length 12
  bytes[i++] = 0x45; bytes[i++] = 0x78; bytes[i++] = 0x69; bytes[i++] = 0x66; bytes[i++] = 0x00; bytes[i++] = 0x00; // Exif\0\0
  bytes[i++] = 0xAA; bytes[i++] = 0xBB; bytes[i++] = 0xCC; bytes[i++] = 0xDD;
  
  // SOS
  bytes[i++] = 0xFF; bytes[i++] = 0xDA;
  bytes[i++] = 0x00; bytes[i++] = 0x04; // length 4
  bytes[i++] = 0x33; bytes[i++] = 0x44; // fake entropy payload
  
  // EOI
  bytes[i++] = 0xFF; bytes[i++] = 0xD9;
  return bytes.subarray(0, i);
}

function createMockPng() {
  // Signature(8) + IHDR(12+12) + eXIf(12+4) + IDAT(12+4) + IEND(12+0) = 76 bytes
  // Actually chunk = 4 len + 4 type + data + 4 CRC
  const bytes = new Uint8Array(64);
  let i = 0;
  // Sig
  const sig = [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A];
  for(let b of sig) bytes[i++] = b;
  
  // IHDR (len 0)
  bytes[i++] = 0; bytes[i++] = 0; bytes[i++] = 0; bytes[i++] = 0;
  const ihdr = [0x49, 0x48, 0x44, 0x52]; // IHDR
  for(let b of ihdr) bytes[i++] = b;
  bytes[i++] = 0; bytes[i++] = 0; bytes[i++] = 0; bytes[i++] = 0; // crc
  
  // eXIf (len 4)
  bytes[i++] = 0; bytes[i++] = 0; bytes[i++] = 0; bytes[i++] = 4;
  const exif = [0x65, 0x58, 0x49, 0x66]; // eXIf
  for(let b of exif) bytes[i++] = b;
  bytes[i++] = 1; bytes[i++] = 2; bytes[i++] = 3; bytes[i++] = 4; // data
  bytes[i++] = 0; bytes[i++] = 0; bytes[i++] = 0; bytes[i++] = 0; // crc
  
  // IDAT (len 4)
  bytes[i++] = 0; bytes[i++] = 0; bytes[i++] = 0; bytes[i++] = 4;
  const idat = [0x49, 0x44, 0x41, 0x54]; // IDAT
  for(let b of idat) bytes[i++] = b;
  bytes[i++] = 9; bytes[i++] = 9; bytes[i++] = 9; bytes[i++] = 9; // data
  bytes[i++] = 0; bytes[i++] = 0; bytes[i++] = 0; bytes[i++] = 0; // crc
  
  // IEND (len 0)
  bytes[i++] = 0; bytes[i++] = 0; bytes[i++] = 0; bytes[i++] = 0;
  const iend = [0x49, 0x45, 0x4E, 0x44]; // IEND
  for(let b of iend) bytes[i++] = b;
  bytes[i++] = 0; bytes[i++] = 0; bytes[i++] = 0; bytes[i++] = 0; // crc
  
  return bytes.subarray(0, i);
}

function createMockWebp() {
  // RIFF (4) + size (4) + WEBP (4) + EXIF (4+4+4) + VP8 (4+4+4)
  const bytes = new Uint8Array(44);
  let i = 0;
  
  const riff = [0x52, 0x49, 0x46, 0x46]; // RIFF
  for(let b of riff) bytes[i++] = b;
  
  // size = 4(WEBP) + 12(EXIF) + 12(VP8) = 28
  bytes[i++] = 28; bytes[i++] = 0; bytes[i++] = 0; bytes[i++] = 0;
  
  const webp = [0x57, 0x45, 0x42, 0x50]; // WEBP
  for(let b of webp) bytes[i++] = b;
  
  const exif = [0x45, 0x58, 0x49, 0x46]; // EXIF
  for(let b of exif) bytes[i++] = b;
  bytes[i++] = 4; bytes[i++] = 0; bytes[i++] = 0; bytes[i++] = 0; // size 4
  bytes[i++] = 1; bytes[i++] = 2; bytes[i++] = 3; bytes[i++] = 4; // data
  
  const vp8 = [0x56, 0x50, 0x38, 0x20]; // VP8 
  for(let b of vp8) bytes[i++] = b;
  bytes[i++] = 4; bytes[i++] = 0; bytes[i++] = 0; bytes[i++] = 0; // size 4
  bytes[i++] = 9; bytes[i++] = 9; bytes[i++] = 9; bytes[i++] = 9; // data
  
  return bytes.subarray(0, i);
}


describe('Binary Sanitizer Engine', () => {

  describe('JPEG Carver', () => {
    it('losslessly removes APP1 (Exif) while preserving SOS payload byte-for-byte', () => {
      const input = createMockJpeg();
      const policy = { removeExif: true, removeXmp: true, removeIcc: true, preserveC2pa: false, removeC2pa: true };
      
      const result = sanitizeJpeg(input, policy);
      expect(result.status).toBe('success');
      expect(result.removedSegments.length).toBe(1);
      expect(result.removedSegments[0].type).toBe('APP1_EXIF');
      
      // Expected output size: 26 - 16 (APP1) = 10
      expect(result.outputBytes.length).toBe(10);
      
      // Verify SOI
      expect(result.outputBytes[0]).toBe(0xFF);
      expect(result.outputBytes[1]).toBe(0xD8);
      
      // Verify SOS and payload
      expect(result.outputBytes[2]).toBe(0xFF);
      expect(result.outputBytes[3]).toBe(0xDA);
      expect(result.outputBytes[4]).toBe(0x00);
      expect(result.outputBytes[5]).toBe(0x04);
      expect(result.outputBytes[6]).toBe(0x33);
      expect(result.outputBytes[7]).toBe(0x44);
      
      // Verify EOI
      expect(result.outputBytes[8]).toBe(0xFF);
      expect(result.outputBytes[9]).toBe(0xD9);

      // --- INVARIANT ASSERTION: Byte Identity ---
      // The remaining bytes (SOI, SOS payload, EOI) MUST perfectly match the original.
      // Expected surviving slices: input[0:2] (SOI), input[16:24] (SOS + EOI)
      const expectedBytes = new Uint8Array([
        ...input.subarray(0, 2), // SOI
        ...input.subarray(16, 24) // SOS + EOI
      ]);
      expect(result.outputBytes).toEqual(expectedBytes);
    });

    it('handles malformed truncated JPEGs safely', () => {
      const input = createMockJpeg().subarray(0, 5); // truncated in middle of APP1
      const result = sanitizeJpeg(input, { removeExif: true });
      expect(result.status).toBe('malformed');
      expect(result.error).toMatch(/truncated/i);
    });
  });

  describe('PNG Carver', () => {
    it('losslessly removes eXIf while preserving IDAT payload byte-for-byte', () => {
      const input = createMockPng();
      const policy = { removeExif: true };
      
      const result = sanitizePng(input, policy);
      expect(result.status).toBe('success');
      expect(result.removedSegments.length).toBe(1);
      expect(result.removedSegments[0].type).toBe('Chunk_eXIf');
      
      // Input length 64, eXIf is 16 bytes. Output = 48.
      expect(result.outputBytes.length).toBe(48);

      // --- INVARIANT ASSERTION: Byte Identity ---
      // Original Sig(8) + IHDR(12) = 20
      // eXIf chunk is from 20 to 36
      // We expect everything EXCEPT the eXIf chunk (bytes 20 to 36) to be identical.
      const expectedBytes = new Uint8Array([
        ...input.subarray(0, 20),
        ...input.subarray(36, 64)
      ]);
      expect(result.outputBytes).toEqual(expectedBytes);
    });
  });

  describe('WebP Carver', () => {
    it('losslessly removes EXIF chunk and updates RIFF size', () => {
      const input = createMockWebp();
      const policy = { removeExif: true };
      
      const result = sanitizeWebp(input, policy);
      expect(result.status).toBe('success');
      expect(result.removedSegments.length).toBe(1);
      expect(result.removedSegments[0].type).toBe('Chunk_EXIF');
      
      // Input length 36, EXIF is 12 bytes. Output = 24.
      expect(result.outputBytes.length).toBe(24);
      
      // New RIFF size: 24 - 8 = 16
      const newSize = result.outputBytes[4] | (result.outputBytes[5] << 8);
      expect(newSize).toBe(16);
    });
  });

  describe('Router (index.js)', () => {
    it('routes correctly based on magic bytes', () => {
      const jpeg = createMockJpeg();
      const result = sanitizeImage(jpeg, { removeExif: true });
      expect(result.format).toBe('jpeg');
      expect(result.status).toBe('success');
    });

    it('rejects unsupported formats gracefully', () => {
      const randomBytes = new Uint8Array([0x1, 0x2, 0x3, 0x4, 0x5, 0x6, 0x7, 0x8, 0x9, 0xA, 0xB, 0xC]);
      const result = sanitizeImage(randomBytes, {});
      expect(result.status).toBe('unsupported');
    });
  });
});
