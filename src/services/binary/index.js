import { validatePolicy } from './policy.js';
import { sanitizeJpeg } from './jpegCarver.js';
import { sanitizePng } from './pngCarver.js';
import { sanitizeWebp } from './webpCarver.js';
import { sanitizeHeif } from './heifCarver.js';
import { sanitizeGif } from './gifCarver.js';
import { sanitizeAvif } from './avifCarver.js';
import { sanitizeVideo } from './videoCarver.js';
import { sanitizePdf } from './pdfCarver.js';
import { createResult } from './policy.js';

const textDecoder = new TextDecoder('ascii');

export function getFormatFromMagicBytes(bytes) {
  if (bytes.length < 4) return 'unknown';

  // PDF: %PDF-
  if (bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46) {
    return 'pdf';
  }

  // JPEG: FF D8 FF
  if (bytes.length >= 3 && bytes[0] === 0xFF && bytes[1] === 0xD8 && bytes[2] === 0xFF) {
    return 'jpeg';
  }

  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (bytes.length >= 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4E && bytes[3] === 0x47) {
    return 'png';
  }

  // GIF: GIF87a or GIF89a
  if (
    bytes.length >= 6 &&
    bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46 &&
    bytes[3] === 0x38 && (bytes[4] === 0x37 || bytes[4] === 0x39) && bytes[5] === 0x61
  ) {
    return 'gif';
  }

  // WebP: RIFF .... WEBP
  if (bytes.length >= 12) {
    const riff = textDecoder.decode(bytes.subarray(0, 4));
    const webp = textDecoder.decode(bytes.subarray(8, 12));
    if (riff === 'RIFF' && webp === 'WEBP') {
      return 'webp';
    }
  }

  // ISOBMFF formats: ftyp at bytes 4-8
  if (bytes.length >= 12) {
    const ftyp = textDecoder.decode(bytes.subarray(4, 8));
    if (ftyp === 'ftyp') {
      const majorBrand = textDecoder.decode(bytes.subarray(8, 12));
      const ftypLen = (bytes[0] << 24) | (bytes[1] << 16) | (bytes[2] << 8) | bytes[3];

      // AVIF: major brand or compatible brand avif/avis
      let isAvif = majorBrand === 'avif' || majorBrand === 'avis';
      if (!isAvif && ftypLen > 16) {
        for (let b = 16; b + 4 <= Math.min(bytes.length, ftypLen); b += 4) {
          const brand = textDecoder.decode(bytes.subarray(b, b + 4));
          if (brand === 'avif' || brand === 'avis') {
            isAvif = true;
            break;
          }
        }
      }
      if (isAvif) return 'avif';

      // Video: QuickTime MOV (qt  ) or MP4 (mp41, mp42, isom, iso2, M4V , etc.)
      if (majorBrand === 'qt  ') return 'mov';
      if (
        majorBrand === 'isom' || majorBrand === 'iso2' ||
        majorBrand.startsWith('mp4') || majorBrand.startsWith('M4V') ||
        majorBrand === 'dash'
      ) {
        return 'mp4';
      }

      // Check compatible brands for video
      if (ftypLen > 16) {
        for (let b = 16; b + 4 <= Math.min(bytes.length, ftypLen); b += 4) {
          const brand = textDecoder.decode(bytes.subarray(b, b + 4));
          if (brand === 'mp41' || brand === 'mp42' || brand === 'isom' || brand === 'qt  ') {
            return brand === 'qt  ' ? 'mov' : 'mp4';
          }
        }
      }

      return 'heic';
    }
  }

  return 'unknown';
}

/**
 * Sanitizes any supported media file losslessly based on the provided policy.
 * @param {Uint8Array} fileBytes 
 * @param {Object} policy 
 * @returns {Object} result object containing outputBytes, status, etc.
 */
export function sanitizeImage(fileBytes, policy = {}) {
  let normalizedPolicy;
  try {
    normalizedPolicy = validatePolicy(policy);
  } catch (err) {
    return createResult({
      format: 'unknown',
      inputBytes: fileBytes,
      status: 'unsafe',
      error: err.message
    });
  }

  const format = getFormatFromMagicBytes(fileBytes);

  switch (format) {
    case 'jpeg':
      return sanitizeJpeg(fileBytes, normalizedPolicy);
    case 'png':
      return sanitizePng(fileBytes, normalizedPolicy);
    case 'webp':
      return sanitizeWebp(fileBytes, normalizedPolicy);
    case 'gif':
      return sanitizeGif(fileBytes, normalizedPolicy);
    case 'avif':
      return sanitizeAvif(fileBytes, normalizedPolicy);
    case 'heic':
      return sanitizeHeif(fileBytes, normalizedPolicy);
    case 'mp4':
    case 'mov':
      return sanitizeVideo(fileBytes, normalizedPolicy);
    case 'pdf':
      return sanitizePdf(fileBytes, normalizedPolicy);
    default:
      return createResult({
        format: 'unknown',
        inputBytes: fileBytes,
        status: 'unsupported',
        error: 'Unsupported file format for binary sanitization.'
      });
  }
}
