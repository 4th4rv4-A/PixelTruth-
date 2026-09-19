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

/** Max safe pixel dimensions (e.g. 64 Megapixels) to prevent decompression bombs */
const MAX_PIXELS = 8000 * 8000;

/**
 * Checks file dimensions using EXIF headers (without full decompression)
 * @param {File} file
 * @returns {Promise<boolean>} true if safe, false if too large
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
    // Some formats might not report width/height to exifr
    if (!meta) return true;

    const w = meta.ImageWidth || meta.PixelXDimension || meta.ExifImageWidth;
    const h = meta.ImageHeight || meta.PixelYDimension || meta.ExifImageHeight;

    if (w && h) {
      if (w * h > MAX_PIXELS) return false;
    }
    return true;
  } catch {
    // If it fails to parse, we conservatively allow it (might be stripped WebP/PNG)
    return true;
  }
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

