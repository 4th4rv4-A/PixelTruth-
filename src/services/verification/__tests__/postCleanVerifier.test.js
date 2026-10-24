import { describe, it, expect } from 'vitest';
import { verifyPostClean, VERIFICATION_STATUS } from '../postCleanVerifier.js';
import { sanitizeJpeg } from '../../binary/jpegCarver.js';
import { sanitizePng } from '../../binary/pngCarver.js';
import { sanitizeWebp } from '../../binary/webpCarver.js';
import { sanitizeVideo } from '../../binary/videoCarver.js';

describe('Format-Specific Post-Clean Verifier (postCleanVerifier.js)', () => {

  // Helper to create minimal valid clean JPEG
  function createCleanJpeg() {
    return new Uint8Array([
      0xFF, 0xD8, // SOI
      0xFF, 0xDB, 0x00, 0x43, 0x00, ...new Array(64).fill(1), // DQT
      0xFF, 0xC0, 0x00, 0x0B, 0x08, 0x00, 0x0A, 0x00, 0x0A, 0x01, 0x01, 0x11, 0x00, // SOF0 (10x10)
      0xFF, 0xDA, 0x00, 0x08, 0x01, 0x01, 0x00, 0x00, 0x3F, 0x00, // SOS
      0x12, 0x34, // Scan data
      0xFF, 0xD9  // EOI
    ]);
  }

  // Helper to create clean PNG
  function createCleanPng() {
    const sig = [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A];
    const ihdr = [
      0x00, 0x00, 0x00, 0x0D,
      0x49, 0x48, 0x44, 0x52,
      0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
      0x08, 0x02, 0x00, 0x00, 0x00,
      0x90, 0x77, 0x53, 0xDE
    ];
    const idat = [
      0x00, 0x00, 0x00, 0x0A,
      0x49, 0x44, 0x41, 0x54,
      0x78, 0x9C, 0x63, 0x00, 0x01, 0x00, 0x00, 0x05, 0x00, 0x01,
      0x0D, 0x0A, 0x2D, 0xB4
    ];
    const iend = [
      0x00, 0x00, 0x00, 0x00,
      0x49, 0x45, 0x4E, 0x44,
      0xAE, 0x42, 0x60, 0x82
    ];
    return new Uint8Array([...sig, ...ihdr, ...idat, ...iend]);
  }

  // Helper to create clean WebP
  function createCleanWebp() {
    const riffHeader = [
      0x52, 0x49, 0x46, 0x46, // 'RIFF'
      0x20, 0x00, 0x00, 0x00, // length 32
      0x57, 0x45, 0x42, 0x50  // 'WEBP'
    ];
    const vp8Chunk = [
      0x56, 0x50, 0x38, 0x20, // 'VP8 '
      0x0A, 0x00, 0x00, 0x00, // length 10
      0x10, 0x00, 0x00, 0x9D, 0x01, 0x2A, 0x01, 0x00, 0x01, 0x00 // keyframe
    ];
    return new Uint8Array([...riffHeader, ...vp8Chunk]);
  }

  it('rejects empty or null bytes with VERIFICATION_FAILED', async () => {
    const res = await verifyPostClean(null);
    expect(res.status).toBe(VERIFICATION_STATUS.FAILED);
    expect(res.details.structuralValidity).toBe(false);
  });

  describe('JPEG Verification', () => {
    it('passes verification on structurally sound clean JPEG', async () => {
      const clean = createCleanJpeg();
      const res = await verifyPostClean(clean, { fullSanitize: true });

      expect(res.status).toBe(VERIFICATION_STATUS.PASSED);
      expect(res.remnants).toHaveLength(0);
      expect(res.verifiedCategories).toContain('CONTAINER_STRUCTURE');
      expect(res.verifiedCategories).toContain('EXIF');
      expect(res.verifiedCategories).toContain('GPS');
      expect(res.verifiedCategories).toContain('XMP');
      expect(res.verifiedCategories).toContain('C2PA_JUMBF');
    });

    it('flags unremoved APP1 XMP in JPEG as METADATA_REMAINS', async () => {
      const xmpPayload = new TextEncoder().encode('http://ns.adobe.com/xap/1.0/\0<x:xmpmeta/>');
      const app1Xmp = [
        0xFF, 0xE1,
        (xmpPayload.length + 2) >> 8, (xmpPayload.length + 2) & 0xFF,
        ...xmpPayload
      ];
      const withXmp = new Uint8Array([
        0xFF, 0xD8,
        ...app1Xmp,
        0xFF, 0xDB, 0x00, 0x43, 0x00, ...new Array(64).fill(1),
        0xFF, 0xC0, 0x00, 0x0B, 0x08, 0x00, 0x0A, 0x00, 0x0A, 0x01, 0x01, 0x11, 0x00,
        0xFF, 0xDA, 0x00, 0x08, 0x01, 0x01, 0x00, 0x00, 0x3F, 0x00,
        0x12, 0x34,
        0xFF, 0xD9
      ]);

      const res = await verifyPostClean(withXmp, { removeXmp: true });
      expect(res.status).toBe(VERIFICATION_STATUS.METADATA_REMAINS);
      const xmpRemnant = res.remnants.find(r => r.category === 'XMP');
      expect(xmpRemnant).toBeDefined();
    });

    it('flags unremoved C2PA APP11 in JPEG as METADATA_REMAINS', async () => {
      const c2paPayload = new TextEncoder().encode('JP\0\0jumb\0\0c2pa_manifest');
      const app11 = [
        0xFF, 0xEB,
        (c2paPayload.length + 2) >> 8, (c2paPayload.length + 2) & 0xFF,
        ...c2paPayload
      ];
      const withC2pa = new Uint8Array([
        0xFF, 0xD8,
        ...app11,
        0xFF, 0xDB, 0x00, 0x43, 0x00, ...new Array(64).fill(1),
        0xFF, 0xC0, 0x00, 0x0B, 0x08, 0x00, 0x0A, 0x00, 0x0A, 0x01, 0x01, 0x11, 0x00,
        0xFF, 0xDA, 0x00, 0x08, 0x01, 0x01, 0x00, 0x00, 0x3F, 0x00,
        0x12, 0x34,
        0xFF, 0xD9
      ]);

      const res = await verifyPostClean(withC2pa, { removeC2pa: true });
      expect(res.status).toBe(VERIFICATION_STATUS.METADATA_REMAINS);
      const c2paRemnant = res.remnants.find(r => r.category === 'C2PA_JUMBF');
      expect(c2paRemnant).toBeDefined();
    });

    it('flags truncated JPEG missing EOI as VERIFICATION_FAILED', async () => {
      const truncated = new Uint8Array([
        0xFF, 0xD8,
        0xFF, 0xDB, 0x00, 0x43, 0x00, ...new Array(64).fill(1),
        0xFF, 0xDA, 0x00, 0x08, 0x01, 0x01, 0x00, 0x00, 0x3F, 0x00,
        0x12, 0x34
        // Missing EOI
      ]);

      const res = await verifyPostClean(truncated);
      expect(res.status).toBe(VERIFICATION_STATUS.FAILED);
      expect(res.details.structuralValidity).toBe(false);
    });

    it('verifies JPEG cleaned with sanitizeJpeg passes post-clean verification', async () => {
      // Create a JPEG with comments and sanitize it
      const com = [0xFF, 0xFE, 0x00, 0x08, 0x54, 0x45, 0x53, 0x54, 0x53, 0x00];
      const dirty = new Uint8Array([
        0xFF, 0xD8,
        ...com,
        0xFF, 0xDB, 0x00, 0x43, 0x00, ...new Array(64).fill(1),
        0xFF, 0xC0, 0x00, 0x0B, 0x08, 0x00, 0x0A, 0x00, 0x0A, 0x01, 0x01, 0x11, 0x00,
        0xFF, 0xDA, 0x00, 0x08, 0x01, 0x01, 0x00, 0x00, 0x3F, 0x00,
        0x12, 0x34,
        0xFF, 0xD9
      ]);

      const cleaned = sanitizeJpeg(dirty, { fullSanitize: true });
      expect(cleaned.status).toBe('success');

      const verification = await verifyPostClean(cleaned.outputBytes, { fullSanitize: true });
      expect(verification.status).toBe(VERIFICATION_STATUS.PASSED);
      expect(verification.remnants).toHaveLength(0);
    });
  });

  describe('PNG Verification', () => {
    it('passes verification on structurally sound clean PNG', async () => {
      const clean = createCleanPng();
      const res = await verifyPostClean(clean, { fullSanitize: true });

      expect(res.status).toBe(VERIFICATION_STATUS.PASSED);
      expect(res.remnants).toHaveLength(0);
      expect(res.verifiedCategories).toContain('CONTAINER_STRUCTURE');
      expect(res.verifiedCategories).toContain('EXIF');
      expect(res.verifiedCategories).toContain('C2PA_JUMBF');
    });

    it('flags unremoved eXIf chunk in PNG as METADATA_REMAINS', async () => {
      const sig = [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A];
      const ihdr = [
        0x00, 0x00, 0x00, 0x0D,
        0x49, 0x48, 0x44, 0x52,
        0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
        0x08, 0x02, 0x00, 0x00, 0x00,
        0x90, 0x77, 0x53, 0xDE
      ];
      const exifChunk = [
        0x00, 0x00, 0x00, 0x06,
        0x65, 0x58, 0x49, 0x66, // 'eXIf'
        0x49, 0x49, 0x2A, 0x00, 0x08, 0x00,
        0x00, 0x00, 0x00, 0x00
      ];
      const idat = [
        0x00, 0x00, 0x00, 0x0A,
        0x49, 0x44, 0x41, 0x54,
        0x78, 0x9C, 0x63, 0x00, 0x01, 0x00, 0x00, 0x05, 0x00, 0x01,
        0x0D, 0x0A, 0x2D, 0xB4
      ];
      const iend = [
        0x00, 0x00, 0x00, 0x00,
        0x49, 0x45, 0x4E, 0x44,
        0xAE, 0x42, 0x60, 0x82
      ];
      const withExif = new Uint8Array([...sig, ...ihdr, ...exifChunk, ...idat, ...iend]);

      const res = await verifyPostClean(withExif, { removeExif: true });
      expect(res.status).toBe(VERIFICATION_STATUS.METADATA_REMAINS);
      const exifRemnant = res.remnants.find(r => r.category === 'EXIF');
      expect(exifRemnant).toBeDefined();
    });

    it('verifies PNG cleaned with sanitizePng passes post-clean verification', async () => {
      const sig = [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A];
      const ihdr = [
        0x00, 0x00, 0x00, 0x0D,
        0x49, 0x48, 0x44, 0x52,
        0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
        0x08, 0x02, 0x00, 0x00, 0x00,
        0x90, 0x77, 0x53, 0xDE
      ];
      const textChunk = [
        0x00, 0x00, 0x00, 0x09,
        0x74, 0x45, 0x58, 0x74, // 'tEXt'
        0x41, 0x75, 0x74, 0x68, 0x6F, 0x72, 0x00, 0x4D, 0x65,
        0x00, 0x00, 0x00, 0x00
      ];
      const idat = [
        0x00, 0x00, 0x00, 0x0A,
        0x49, 0x44, 0x41, 0x54,
        0x78, 0x9C, 0x63, 0x00, 0x01, 0x00, 0x00, 0x05, 0x00, 0x01,
        0x0D, 0x0A, 0x2D, 0xB4
      ];
      const iend = [
        0x00, 0x00, 0x00, 0x00,
        0x49, 0x45, 0x4E, 0x44,
        0xAE, 0x42, 0x60, 0x82
      ];
      const raw = new Uint8Array([...sig, ...ihdr, ...textChunk, ...idat, ...iend]);

      const cleaned = sanitizePng(raw, { fullSanitize: true });
      expect(cleaned.status).toBe('success');

      const verification = await verifyPostClean(cleaned.outputBytes, { fullSanitize: true });
      expect(verification.status).toBe(VERIFICATION_STATUS.PASSED);
      expect(verification.remnants).toHaveLength(0);
    });
  });

  describe('WebP Verification', () => {
    it('passes verification on clean WebP', async () => {
      const clean = createCleanWebp();
      const res = await verifyPostClean(clean, { fullSanitize: true });

      expect(res.status).toBe(VERIFICATION_STATUS.PASSED);
      expect(res.remnants).toHaveLength(0);
    });

    it('flags unremoved EXIF chunk in WebP as METADATA_REMAINS', async () => {
      const riffHeader = [
        0x52, 0x49, 0x46, 0x46,
        0x24, 0x00, 0x00, 0x00,
        0x57, 0x45, 0x42, 0x50
      ];
      const exifChunk = [
        0x45, 0x58, 0x49, 0x46, // 'EXIF'
        0x06, 0x00, 0x00, 0x00, // length 6
        0x49, 0x49, 0x2A, 0x00, 0x08, 0x00
      ];
      const vp8Chunk = [
        0x56, 0x50, 0x38, 0x20,
        0x0A, 0x00, 0x00, 0x00,
        0x10, 0x00, 0x00, 0x9D, 0x01, 0x2A, 0x01, 0x00, 0x01, 0x00
      ];
      const withExif = new Uint8Array([...riffHeader, ...exifChunk, ...vp8Chunk]);

      const res = await verifyPostClean(withExif, { removeExif: true });
      expect(res.status).toBe(VERIFICATION_STATUS.METADATA_REMAINS);
      const exifRemnant = res.remnants.find(r => r.category === 'EXIF');
      expect(exifRemnant).toBeDefined();
    });

    it('verifies WebP cleaned with sanitizeWebp passes post-clean verification', async () => {
      const riffHeader = [
        0x52, 0x49, 0x46, 0x46,
        0x24, 0x00, 0x00, 0x00,
        0x57, 0x45, 0x42, 0x50
      ];
      const exifChunk = [
        0x45, 0x58, 0x49, 0x46,
        0x06, 0x00, 0x00, 0x00,
        0x49, 0x49, 0x2A, 0x00, 0x08, 0x00
      ];
      const vp8Chunk = [
        0x56, 0x50, 0x38, 0x20,
        0x0A, 0x00, 0x00, 0x00,
        0x10, 0x00, 0x00, 0x9D, 0x01, 0x2A, 0x01, 0x00, 0x01, 0x00
      ];
      const raw = new Uint8Array([...riffHeader, ...exifChunk, ...vp8Chunk]);

      const cleaned = sanitizeWebp(raw, { fullSanitize: true });
      expect(cleaned.status).toBe('success');

      const verification = await verifyPostClean(cleaned.outputBytes, { fullSanitize: true });
      expect(verification.status).toBe(VERIFICATION_STATUS.PASSED);
      expect(verification.remnants).toHaveLength(0);
    });
  });

  describe('Video Verification', () => {
    function createVideo(udtaType = 'udta') {
      const ftyp = [0, 0, 0, 16, 0x66, 0x74, 0x79, 0x70, 0x69, 0x73, 0x6F, 0x6D, 0, 0, 2, 0];
      const typeBytes = new TextEncoder().encode(udtaType);
      const udta = [0, 0, 0, 16, ...typeBytes, 0xA9, 0x78, 0x79, 0x7A, 0x2B, 0x33, 0x37, 0x2E];
      const moov = [0, 0, 0, 24, 0x6D, 0x6F, 0x6F, 0x76, ...udta];
      const mdat = [0, 0, 0, 12, 0x6D, 0x64, 0x61, 0x74, 1, 2, 3, 4];
      return new Uint8Array([...ftyp, ...moov, ...mdat]);
    }

    it('flags active udta atom in video as METADATA_REMAINS', async () => {
      const video = createVideo('udta');
      const res = await verifyPostClean(video);
      expect(res.status).toBe(VERIFICATION_STATUS.METADATA_REMAINS);
      const gpsRemnant = res.remnants.find(r => r.category === 'GPS');
      expect(gpsRemnant).toBeDefined();
    });

    it('passes video when udta has been transformed to free', async () => {
      const raw = createVideo('udta');
      const cleaned = sanitizeVideo(raw);
      expect(cleaned.status).toBe('success');

      const res = await verifyPostClean(cleaned.outputBytes);
      expect(res.status).toBe(VERIFICATION_STATUS.PASSED);
      expect(res.remnants).toHaveLength(0);
    });
  });
});
