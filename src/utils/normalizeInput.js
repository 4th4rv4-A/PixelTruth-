import heic2any from 'heic2any';

/**
 * If the file is HEIC/HEIF, convert it to JPEG client-side.
 * Otherwise return the file unchanged.
 * @param {File} file
 * @returns {Promise<File>}
 */
export async function normalizeInput(file) {
  const isHeic =
    file.type === 'image/heic' ||
    file.type === 'image/heif' ||
    /\.heic$/i.test(file.name) ||
    /\.heif$/i.test(file.name);

  if (!isHeic) return file;

  const converted = await heic2any({
    blob: file,
    toType: 'image/jpeg',
    quality: 0.95,
  });

  const blob = Array.isArray(converted) ? converted[0] : converted;
  const newName = file.name.replace(/\.heic$/i, '.jpg').replace(/\.heif$/i, '.jpg');
  return new File([blob], newName, { type: 'image/jpeg' });
}

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
