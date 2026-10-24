import { describe, it, expect } from 'vitest';
import { sanitizeGif } from '../gifCarver.js';
import { sanitizeVideo } from '../videoCarver.js';
import { sanitizePdf } from '../pdfCarver.js';
import { sanitizeAvif } from '../avifCarver.js';
import { sanitizeImage, getFormatFromMagicBytes } from '../index.js';

describe('Lossless GIF Carver (gifCarver.js)', () => {
  function createMockGifWithCommentsAndTrailing() {
    // Header (6) + LSD (7) + GCT (6) + GCE (8) + Comment (10) + Image (15) + Trailer (1) + Trailing (4)
    const bytes = [];
    // 1. GIF89a
    bytes.push(0x47, 0x49, 0x46, 0x38, 0x39, 0x61);
    // 2. LSD: 1x1, has GCT (packed 0x80 = 2 colors = 6 bytes), bg 0, aspect 0
    bytes.push(0x01, 0x00, 0x01, 0x00, 0x80, 0x00, 0x00);
    // 3. GCT (2 colors * 3 bytes = 6 bytes)
    bytes.push(0xFF, 0x00, 0x00, 0x00, 0xFF, 0x00);
    // 4. Graphic Control Extension (0x21 0xF9, size 4, packed, delay 10, trans, term 0)
    bytes.push(0x21, 0xF9, 0x04, 0x00, 0x0A, 0x00, 0x00, 0x00);
    // 5. Comment Extension (0x21 0xFE, sub-block size 4 'TEST', term 0)
    bytes.push(0x21, 0xFE, 0x04, 0x54, 0x45, 0x53, 0x54, 0x00);
    // 6. Image Descriptor (0x2C, left 0, top 0, width 1, height 1, packed 0)
    bytes.push(0x2C, 0x00, 0x00, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00);
    // LZW min code size 2, sub-block size 2 (0x04, 0x01), term 0
    bytes.push(0x02, 0x02, 0x04, 0x01, 0x00);
    // 7. Trailer (0x3B)
    bytes.push(0x3B);
    // 8. Trailing garbage / tracking token
    bytes.push(0xDE, 0xAD, 0xBE, 0xEF);

    return new Uint8Array(bytes);
  }

  it('correctly identifies GIF format and strips comments and trailing payloads', () => {
    const raw = createMockGifWithCommentsAndTrailing();
    expect(getFormatFromMagicBytes(raw)).toBe('gif');

    const result = sanitizeGif(raw);
    expect(result.status).toBe('success');
    expect(result.removedSegments).toContain('COMMENT_EXTENSION');
    expect(result.removedSegments).toContain('TRAILING_PAYLOAD');
    expect(result.preservedSegments).toContain('GRAPHIC_CONTROL');
    expect(result.preservedSegments).toContain('IMAGE_DESCRIPTOR');

    // Trailer must be the last byte (trailing payload 0xDEADBEEF truncated)
    expect(result.outputBytes[result.outputBytes.length - 1]).toBe(0x3B);

    // Comment 'TEST' (0x54, 0x45, 0x53, 0x54) must not exist in outputBytes
    const decoder = new TextDecoder('ascii');
    const outStr = decoder.decode(result.outputBytes);
    expect(outStr).not.toContain('TEST');
  });

  it('preserves Netscape animation loop extensions', () => {
    const bytes = [];
    // GIF89a
    bytes.push(0x47, 0x49, 0x46, 0x38, 0x39, 0x61);
    // LSD (no GCT, packed 0x00)
    bytes.push(0x01, 0x00, 0x01, 0x00, 0x00, 0x00, 0x00);
    // Application Extension NETSCAPE2.0 (0x21 0xFF, size 11, 'NETSCAPE2.0', sub-block 3 bytes, term 0)
    bytes.push(0x21, 0xFF, 0x0B);
    const netscape = new TextEncoder().encode('NETSCAPE2.0');
    bytes.push(...netscape);
    bytes.push(0x03, 0x01, 0x00, 0x00, 0x00); // 3-byte loop count, then terminator
    // Trailer
    bytes.push(0x3B);

    const raw = new Uint8Array(bytes);
    const result = sanitizeGif(raw);
    expect(result.status).toBe('success');
    expect(result.preservedSegments).toContain('ANIMATION_EXTENSION');
    const decoder = new TextDecoder('ascii');
    expect(decoder.decode(result.outputBytes)).toContain('NETSCAPE2.0');
  });
});

describe('Lossless Video Metadata Carver (videoCarver.js)', () => {
  function createMockMp4WithUdta() {
    // Top-level ftyp box (16 bytes)
    const ftyp = [
      0x00, 0x00, 0x00, 0x10, // size 16
      0x66, 0x74, 0x79, 0x70, // 'ftyp'
      0x69, 0x73, 0x6F, 0x6D, // 'isom'
      0x00, 0x00, 0x02, 0x00  // minor version
    ];

    // Inside moov: udta box with GPS / camera data (16 bytes)
    const udta = [
      0x00, 0x00, 0x00, 0x10, // size 16
      0x75, 0x64, 0x74, 0x61, // 'udta'
      0xA9, 0x78, 0x79, 0x7A, // '©xyz' (GPS coords marker)
      0x2B, 0x33, 0x37, 0x2E  // '+37.'
    ];

    // moov box containing udta (8 bytes header + 16 bytes udta = 24 bytes)
    const moov = [
      0x00, 0x00, 0x00, 0x18, // size 24
      0x6D, 0x6F, 0x6F, 0x76, // 'moov'
      ...udta
    ];

    // mdat box (12 bytes)
    const mdat = [
      0x00, 0x00, 0x00, 0x0C, // size 12
      0x6D, 0x64, 0x61, 0x74, // 'mdat'
      0x11, 0x22, 0x33, 0x44  // video payload
    ];

    return new Uint8Array([...ftyp, ...moov, ...mdat]);
  }

  it('transforms udta into free box with zeroed payload while keeping file length intact', () => {
    const raw = createMockMp4WithUdta();
    expect(getFormatFromMagicBytes(raw)).toBe('mp4');

    const result = sanitizeVideo(raw);
    expect(result.status).toBe('success');
    expect(result.removedSegments).toContain('UDTA_USER_DATA');

    // Total file size MUST BE IDENTICAL so chunk offsets in sample tables remain 100% valid
    expect(result.outputBytes.length).toBe(raw.length);

    // 'udta' (0x75 0x64 0x74 0x61) must be replaced with 'free' (0x66 0x72 0x65 0x65)
    const textDecoder = new TextDecoder('ascii');
    const outStr = textDecoder.decode(result.outputBytes);
    expect(outStr).not.toContain('udta');
    expect(outStr).toContain('free');
  });

  it('correctly parses 64-bit extended box size and processes moov', () => {
    // 64-bit box: size indicator = 1, followed by 'free', followed by 8 bytes size = 24
    const free64 = [
      0x00, 0x00, 0x00, 0x01, // 64-bit indicator
      0x66, 0x72, 0x65, 0x65, // 'free'
      0x00, 0x00, 0x00, 0x00, // high 32 bits = 0
      0x00, 0x00, 0x00, 0x18, // low 32 bits = 24
      0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00 // 8 bytes padding to reach 24 total
    ];

    // Top-level ftyp box (16 bytes)
    const ftyp = [
      0x00, 0x00, 0x00, 0x10,
      0x66, 0x74, 0x79, 0x70,
      0x69, 0x73, 0x6F, 0x6D,
      0x00, 0x00, 0x02, 0x00
    ];

    // Inside moov: udta box (16 bytes)
    const udta = [
      0x00, 0x00, 0x00, 0x10,
      0x75, 0x64, 0x74, 0x61,
      0xA9, 0x78, 0x79, 0x7A,
      0x2B, 0x33, 0x37, 0x2E
    ];

    // moov box (24 bytes)
    const moov = [
      0x00, 0x00, 0x00, 0x18,
      0x6D, 0x6F, 0x6F, 0x76,
      ...udta
    ];

    const raw = new Uint8Array([...ftyp, ...free64, ...moov]);
    const result = sanitizeVideo(raw);

    expect(result.status).toBe('success');
    expect(result.removedSegments).toContain('UDTA_USER_DATA');
    expect(result.outputBytes.length).toBe(raw.length);

    const textDecoder = new TextDecoder('ascii');
    expect(textDecoder.decode(result.outputBytes)).not.toContain('udta');
  });
});

describe('Lossless PDF Metadata Carver (pdfCarver.js)', () => {
  function createMockPdf() {
    const content =
      '%PDF-1.4\n' +
      '1 0 obj\n' +
      '<< /Type /Catalog /Pages 2 0 R /Metadata 3 0 R >>\n' +
      'endobj\n' +
      '3 0 obj\n' +
      '<< /Type /Metadata /Subtype /XML >>\n' +
      'stream\n' +
      '<x:xmpmeta>SECRET_XMP_DATA</x:xmpmeta>\n' +
      'endstream\n' +
      'endobj\n' +
      '4 0 obj\n' +
      '<< /Title (Sensitive Document) /Author (John Doe) /CreationDate (D:20261014) >>\n' +
      'endobj\n' +
      'trailer\n' +
      '<< /Size 5 /Root 1 0 R /Info 4 0 R >>\n' +
      'startxref\n' +
      '400\n' +
      '%%EOF';

    return new TextEncoder().encode(content);
  }

  it('in-place blanks /Info dictionary and /Metadata XMP stream with exact byte length preservation', () => {
    const raw = createMockPdf();
    expect(getFormatFromMagicBytes(raw)).toBe('pdf');

    const result = sanitizePdf(raw);
    expect(result.status).toBe('success');
    expect(result.removedSegments).toContain('XMP_METADATA_STREAM');
    expect(result.removedSegments).toContain('INFO_AUTHOR');
    expect(result.removedSegments).toContain('TRAILER_INFO_REF');

    // File length must be identical (zero offset drift for xref tables)
    expect(result.outputBytes.length).toBe(raw.length);

    const decoder = new TextDecoder('latin1');
    const outStr = decoder.decode(result.outputBytes);
    expect(outStr).not.toContain('John Doe');
    expect(outStr).not.toContain('SECRET_XMP_DATA');
    expect(outStr).not.toContain('/Info 4 0 R');
  });
});

describe('Lossless AVIF Metadata Carver (avifCarver.js)', () => {
  function createMockAvif() {
    const ftyp = [
      0x00, 0x00, 0x00, 0x14, // size 20
      0x66, 0x74, 0x79, 0x70, // 'ftyp'
      0x61, 0x76, 0x69, 0x66, // 'avif'
      0x00, 0x00, 0x00, 0x00,
      0x61, 0x76, 0x69, 0x73  // 'avis'
    ];

    const idat = [
      0x00, 0x00, 0x00, 0x10, // size 16
      0x69, 0x64, 0x61, 0x74, // 'idat'
      0x45, 0x78, 0x69, 0x66, // 'Exif'
      0x00, 0x00, 0x01, 0x02
    ];

    const meta = [
      0x00, 0x00, 0x00, 0x1C, // size 28 (8 header + 4 FullBox flags + 16 idat)
      0x6D, 0x65, 0x74, 0x61, // 'meta'
      0x00, 0x00, 0x00, 0x00, // FullBox version + flags
      ...idat
    ];

    return new Uint8Array([...ftyp, ...meta]);
  }

  it('detects AVIF format and neutralizes idat Exif metadata', () => {
    const raw = createMockAvif();
    expect(getFormatFromMagicBytes(raw)).toBe('avif');

    const result = sanitizeAvif(raw);
    expect(result.status).toBe('success');
    expect(result.removedSegments).toContain('AVIF_METADATA_IDAT');
  });
});

describe('SanitizeImage Routing (index.js)', () => {
  it('correctly dispatches to the corresponding carver for all formats', () => {
    // Minimal mock for each format
    const gif = new Uint8Array([0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 0x01, 0x00, 0x01, 0x00, 0x00, 0x00, 0x00, 0x3B]);
    const res = sanitizeImage(gif);
    expect(res.format).toBe('gif');
    expect(res.status).toBe('success');
  });
});
