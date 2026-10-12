import { describe, it, expect } from 'vitest';
import { sanitizeJpeg, extractExifPreserveTags, buildMinimalExifApp1 } from '../jpegCarver.js';
import { sanitizePng } from '../pngCarver.js';
import { sanitizeWebp } from '../webpCarver.js';
import { sanitizeImage } from '../index.js';
import exifr from 'exifr';

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

function createMockJpegWithOrientation(orientation = 6) {
  const tiff = buildMinimalExifApp1(orientation, null);
  const sos = new Uint8Array([0xFF, 0xDA, 0x00, 0x04, 0x33, 0x44, 0xFF, 0xD9]);
  const result = new Uint8Array(2 + tiff.length + sos.length);
  result[0] = 0xFF; result[1] = 0xD8;
  result.set(tiff, 2);
  result.set(sos, 2 + tiff.length);
  return result;
}

function createMockJpegWithFullMetadata(orientation = 6) {
  const totalTiffLen = 142;
  const tiff = new Uint8Array(totalTiffLen);
  const view = new DataView(tiff.buffer);

  tiff[0] = 0x49; tiff[1] = 0x49; // II
  view.setUint16(2, 42, true);
  view.setUint32(4, 8, true); // IFD0 offset

  // IFD0: 5 entries
  view.setUint16(8, 5, true);
  // Make 0x010F
  view.setUint16(10, 0x010F, true);
  view.setUint16(12, 2, true); // ASCII
  view.setUint32(14, 4, true);
  tiff[18] = 0x53; tiff[19] = 0x4F; tiff[20] = 0x4E; tiff[21] = 0x59; // SONY

  // Model 0x0110
  view.setUint16(22, 0x0110, true);
  view.setUint16(24, 2, true);
  view.setUint32(26, 4, true);
  tiff[30] = 0x41; tiff[31] = 0x37; tiff[32] = 0x52; tiff[33] = 0x35; // A7R5

  // Orientation 0x0112
  view.setUint16(34, 0x0112, true);
  view.setUint16(36, 3, true); // SHORT
  view.setUint32(38, 1, true);
  view.setUint16(42, orientation, true);

  // Exif IFD Pointer 0x8769
  view.setUint16(46, 0x8769, true);
  view.setUint16(48, 4, true); // LONG
  view.setUint32(50, 1, true);
  view.setUint32(54, 74, true);

  // GPS IFD Pointer 0x8825
  view.setUint16(58, 0x8825, true);
  view.setUint16(60, 4, true); // LONG
  view.setUint32(62, 1, true);
  view.setUint32(66, 92, true);

  // Next IFD = 0
  view.setUint32(70, 0, true);

  // Exif IFD (offset 74)
  view.setUint16(74, 1, true);
  view.setUint16(76, 0x9003, true); // DateTimeOriginal
  view.setUint16(78, 2, true);
  view.setUint32(80, 20, true);
  view.setUint32(84, 122, true);
  view.setUint32(88, 0, true);

  // GPS IFD (offset 92)
  view.setUint16(92, 2, true);
  view.setUint16(94, 0x0000, true); // GPSVersionID
  view.setUint16(96, 1, true); // BYTE
  view.setUint32(98, 4, true);
  tiff[102] = 2; tiff[103] = 3; tiff[104] = 0; tiff[105] = 0;

  view.setUint16(106, 0x0001, true); // GPSLatitudeRef
  view.setUint16(108, 2, true);
  view.setUint32(110, 2, true);
  tiff[114] = 0x4E; tiff[115] = 0x00; // 'N\0'

  view.setUint32(118, 0, true);

  // String data at offset 122
  const dtStr = new TextEncoder().encode("2026:10:11 12:00:00\0");
  tiff.set(dtStr, 122);

  const app1Len = 2 + 6 + totalTiffLen;
  const app1 = new Uint8Array(2 + app1Len);
  app1[0] = 0xFF; app1[1] = 0xE1;
  app1[2] = (app1Len >> 8) & 0xFF; app1[3] = app1Len & 0xFF;
  app1[4] = 0x45; app1[5] = 0x78; app1[6] = 0x69; app1[7] = 0x66; app1[8] = 0; app1[9] = 0;
  app1.set(tiff, 10);

  const sos = new Uint8Array([0xFF, 0xDA, 0x00, 0x04, 0xDE, 0xAD, 0xBE, 0xEF, 0xFF, 0xD9]);
  const jpeg = new Uint8Array(2 + app1.length + sos.length);
  jpeg[0] = 0xFF; jpeg[1] = 0xD8;
  jpeg.set(app1, 2);
  jpeg.set(sos, 2 + app1.length);
  return jpeg;
}

function createMockJpegWithIcc() {
  const iccPayload = new TextEncoder().encode("ICC_PROFILE\0fake_icc_data_12345");
  const app2Len = 2 + iccPayload.length;
  const app2 = new Uint8Array(2 + app2Len);
  app2[0] = 0xFF; app2[1] = 0xE2; // APP2
  app2[2] = (app2Len >> 8) & 0xFF; app2[3] = app2Len & 0xFF;
  app2.set(iccPayload, 4);

  const sos = new Uint8Array([0xFF, 0xDA, 0x00, 0x04, 0x33, 0x44, 0xFF, 0xD9]);
  const result = new Uint8Array(2 + app2.length + sos.length);
  result[0] = 0xFF; result[1] = 0xD8;
  result.set(app2, 2);
  result.set(sos, 2 + app2.length);
  return result;
}

function createMockJpegNoOrientation() {
  const tiff = new Uint8Array(26);
  const view = new DataView(tiff.buffer);
  tiff[0] = 0x49; tiff[1] = 0x49;
  view.setUint16(2, 42, true);
  view.setUint32(4, 8, true);
  view.setUint16(8, 1, true); // 1 entry: Make only
  view.setUint16(10, 0x010F, true);
  view.setUint16(12, 2, true);
  view.setUint32(14, 4, true);
  tiff[18] = 0x53; tiff[19] = 0x4F; tiff[20] = 0x4E; tiff[21] = 0x59;
  view.setUint32(22, 0, true);

  const app1Len = 2 + 6 + 26;
  const app1 = new Uint8Array(2 + 2 + 6 + 26);
  app1[0] = 0xFF; app1[1] = 0xE1;
  app1[2] = (app1Len >> 8) & 0xFF; app1[3] = app1Len & 0xFF;
  app1[4] = 0x45; app1[5] = 0x78; app1[6] = 0x69; app1[7] = 0x66; app1[8] = 0; app1[9] = 0;
  app1.set(tiff, 10);

  const sos = new Uint8Array([0xFF, 0xDA, 0x00, 0x04, 0x33, 0x44, 0xFF, 0xD9]);
  const result = new Uint8Array(2 + app1.length + sos.length);
  result[0] = 0xFF; result[1] = 0xD8;
  result.set(app1, 2);
  result.set(sos, 2 + app1.length);
  return result;
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

    it('preserves Orientation tag in minimal freshly built APP1 when stripping EXIF', async () => {
      const input = createMockJpegWithOrientation(6);
      const result = sanitizeJpeg(input, { removeExif: true });
      expect(result.status).toBe('success');

      const tags = extractExifPreserveTags(result.outputBytes);
      expect(tags.orientation).toBe(6);

      const parsed = await exifr.parse(result.outputBytes);
      expect(parsed.Orientation).toBe('Rotate 90 CW');
    });

    it('strips GPS, Make, Model, DateTimeOriginal while preserving Orientation and byte-identical SOS payload', async () => {
      const input = createMockJpegWithFullMetadata(6);
      const result = sanitizeJpeg(input, { removeExif: true, removeGps: true });
      expect(result.status).toBe('success');

      // Orientation survived
      const tags = extractExifPreserveTags(result.outputBytes);
      expect(tags.orientation).toBe(6);

      // Other metadata removed
      const parsed = await exifr.parse(result.outputBytes, { tiff: true, exif: true, gps: true });
      expect(parsed.Make).toBeUndefined();
      expect(parsed.Model).toBeUndefined();
      expect(parsed.DateTimeOriginal).toBeUndefined();
      expect(parsed.GPSLatitudeRef).toBeUndefined();

      // SOS -> EOI payload is byte-for-byte identical (deepEqual)
      let inputSosOffset = 2;
      while (inputSosOffset < input.length - 1) {
        if (input[inputSosOffset] === 0xFF && input[inputSosOffset + 1] === 0xDA) break;
        inputSosOffset++;
      }
      let outputSosOffset = 2;
      while (outputSosOffset < result.outputBytes.length - 1) {
        if (result.outputBytes[outputSosOffset] === 0xFF && result.outputBytes[outputSosOffset + 1] === 0xDA) break;
        outputSosOffset++;
      }
      expect(result.outputBytes.subarray(outputSosOffset)).toEqual(input.subarray(inputSosOffset));
    });

    it('preserves APP2 ICC by default, and removes it when Full Sanitize is requested', () => {
      const input = createMockJpegWithIcc();

      // Default policy preserves ICC
      const defaultResult = sanitizeJpeg(input, {});
      expect(defaultResult.status).toBe('success');
      expect(defaultResult.preservedSegments.some(s => s.type === 'APP2_ICC')).toBe(true);
      expect(defaultResult.removedSegments.some(s => s.type === 'APP2_ICC')).toBe(false);

      // Full Sanitize policy removes ICC
      const fullSanitizeResult = sanitizeJpeg(input, { removeIcc: true, fullSanitize: true });
      expect(fullSanitizeResult.status).toBe('success');
      expect(fullSanitizeResult.removedSegments.some(s => s.type === 'APP2_ICC')).toBe(true);
      expect(fullSanitizeResult.preservedSegments.some(s => s.type === 'APP2_ICC')).toBe(false);
    });

    it('does not inject an empty APP1 when input JPEG has no Orientation', () => {
      const input = createMockJpegNoOrientation();
      const result = sanitizeJpeg(input, { removeExif: true });
      expect(result.status).toBe('success');

      const tags = extractExifPreserveTags(result.outputBytes);
      expect(tags.orientation).toBeNull();
      expect(result.preservedSegments.some(s => s.type.startsWith('APP1'))).toBe(false);
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

  describe('C2PA / JUMBF (APP11) stripping', () => {
    function jpegWithJumbf() {
      const manifest = new TextEncoder().encode(
        '\x00\x00\x00\x00JUMBFc2pa{"claim_generator":"Google C2PA Core Generator Library"}'
      );
      const len = 2 + manifest.length;
      const app11 = new Uint8Array(2 + len);
      app11[0] = 0xff; app11[1] = 0xeb;
      app11[2] = (len >> 8) & 0xff; app11[3] = len & 0xff;
      app11.set(manifest, 4);
      const sos = new Uint8Array([0xff, 0xda, 0x00, 0x04, 0x11, 0x22, 0xff, 0xd9]);
      const out = new Uint8Array(2 + app11.length + sos.length);
      out[0] = 0xff; out[1] = 0xd8;
      out.set(app11, 2);
      out.set(sos, 2 + app11.length);
      return out;
    }

    it('strips APP11 C2PA by default (always_strip)', () => {
      const result = sanitizeImage(jpegWithJumbf(), {});
      expect(result.status).toBe('success');
      expect(result.removedSegments.some((s) => s.type === 'APP11_C2PA')).toBe(true);
      expect(result.preservedSegments.some((s) => s.type === 'APP11_C2PA')).toBe(false);
    });

    it('preserves APP11 C2PA when removeC2pa is false', () => {
      const result = sanitizeImage(jpegWithJumbf(), { removeC2pa: false });
      expect(result.status).toBe('success');
      expect(result.preservedSegments.some((s) => s.type === 'APP11_C2PA')).toBe(true);
    });
  });
});
