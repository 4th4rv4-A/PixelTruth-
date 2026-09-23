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

export { validateFile } from '../services/validation/fileValidator.js';

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
