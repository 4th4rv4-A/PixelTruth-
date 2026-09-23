import { validatePolicy } from './policy.js';
import { sanitizeJpeg } from './jpegCarver.js';
import { sanitizePng } from './pngCarver.js';
import { sanitizeWebp } from './webpCarver.js';
import { sanitizeHeif } from './heifCarver.js';
import { createResult } from './policy.js';

const textDecoder = new TextDecoder('ascii');

function getFormatFromMagicBytes(bytes) {
  if (bytes.length < 12) return 'unknown';

  // JPEG: FF D8 FF
  if (bytes[0] === 0xFF && bytes[1] === 0xD8 && bytes[2] === 0xFF) {
    return 'jpeg';
  }

  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4E && bytes[3] === 0x47) {
    return 'png';
  }

  // WebP: RIFF .... WEBP
  const riff = textDecoder.decode(bytes.subarray(0, 4));
  const webp = textDecoder.decode(bytes.subarray(8, 12));
  if (riff === 'RIFF' && webp === 'WEBP') {
    return 'webp';
  }

  // HEIF/HEIC: .... ftyp (brand)
  const ftyp = textDecoder.decode(bytes.subarray(4, 8));
  if (ftyp === 'ftyp') {
    return 'heic';
  }

  return 'unknown';
}

/**
 * Sanitizes an image file losslessly based on the provided policy.
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
    case 'heic':
      return sanitizeHeif(fileBytes, normalizedPolicy);
    default:
      return createResult({
        format: 'unknown',
        inputBytes: fileBytes,
        status: 'unsupported',
        error: 'Unsupported file format for binary sanitization.'
      });
  }
}
