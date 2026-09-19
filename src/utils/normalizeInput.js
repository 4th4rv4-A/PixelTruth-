import exifr from 'exifr';
import heic2any from 'heic2any';

/** Accepted MIME types */
export const ACCEPTED_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/heic',
  'image/heif',
];

/** File extension fallback check */
export const ACCEPTED_EXTENSIONS = /\.(jpe?g|png|webp|heic|heif)$/i;

/** Max file size: 50 MB */
export const MAX_FILE_SIZE = 50 * 1024 * 1024;

/** Max files in queue */
export const MAX_FILES = 20;

/** Max safe pixel dimensions (64 Megapixels) to prevent decompression bombs */
export const MAX_PIXELS = 64 * 1024 * 1024;

/**
 * Conservative file size threshold used when image dimensions
 * cannot be determined from metadata. This is NOT a safety guarantee —
 * it is a pragmatic gate to allow small files through while rejecting
 * large files whose pixel count is unknown.
 */
const CONSERVATIVE_SIZE_LIMIT = 15 * 1024 * 1024;

/**
 * Checks file dimensions using EXIF headers (without full decompression).
 *
 * Behavior:
 * - Dimensions found & within limit → { safe: true }
 * - Dimensions found & over limit  → { safe: false, reason: 'oversized' }
 * - Dimensions not found, file ≤ 15 MB → { safe: true, reason: 'size-fallback' }
 * - Dimensions not found, file > 15 MB → { safe: false, reason: 'unverifiable' }
 * - Metadata parse error, file ≤ 15 MB → { safe: true, reason: 'size-fallback' }
 * - Metadata parse error, file > 15 MB → { safe: false, reason: 'unverifiable' }
 *
 * @param {File} file
 * @returns {Promise<{ safe: boolean, reason?: string }>}
 */
export async function inspectDimensions(file) {
  try {
    const meta = await exifr.parse(file, {
      tiff: true,
      exif: true,
      xmp: true,
      icc: false,
      iptc: false,
      jfif: true,
    });

    if (meta) {
      const w = meta.ImageWidth || meta.PixelXDimension || meta.ExifImageWidth;
      const h = meta.ImageHeight || meta.PixelYDimension || meta.ExifImageHeight;

      if (w && h) {
        if (w * h > MAX_PIXELS) {
          return { safe: false, reason: 'oversized' };
        }
        return { safe: true };
      }
    }

    // Dimensions not found in metadata — use conservative file size fallback
    return conservativeFallback(file);
  } catch {
    // Metadata parsing failed — use conservative file size fallback
    return conservativeFallback(file);
  }
}

/**
 * Conservative fallback when dimensions cannot be determined.
 * @param {File} file
 * @returns {{ safe: boolean, reason: string }}
 */
function conservativeFallback(file) {
  if (file.size <= CONSERVATIVE_SIZE_LIMIT) {
    return { safe: true, reason: 'size-fallback' };
  }
  return { safe: false, reason: 'unverifiable' };
}

/**
 * Helper to safely generate a thumbnail, converting HEIC to a cheap JPEG if needed.
 * Returns the object URL. Does NOT mutate the original file.
 * @param {File} file
 * @returns {Promise<string>}
 */
export async function createSafeThumbnail(file) {
  const isHeic =
    file.type === 'image/heic' ||
    file.type === 'image/heif' ||
    /\.heic$/i.test(file.name) ||
    /\.heif$/i.test(file.name);

  if (!isHeic) {
    return URL.createObjectURL(file);
  }

  try {
    // Create a low-res thumbnail from HEIC
    const converted = await heic2any({
      blob: file,
      toType: 'image/jpeg',
      quality: 0.1,
    });
    const blob = Array.isArray(converted) ? converted[0] : converted;
    return URL.createObjectURL(blob);
  } catch (err) {
    console.error('HEIC thumbnail generation failed:', err);
    // Return a generic fallback if generation fails
    return '';
  }
}
