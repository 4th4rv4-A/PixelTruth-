/**
 * Standard MIME types accepted and mapped to file extensions.
 */
export const MIME_TO_EXTENSION = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
};

/**
 * Resolves the appropriate extension for a given output MIME type.
 * Throws a descriptive error if the MIME type is unsupported or unknown.
 *
 * @param {string} mimeType
 * @returns {string} extension including dot (e.g. '.jpg', '.png', '.webp')
 */
export function resolveOutputExtension(mimeType) {
  if (!mimeType || typeof mimeType !== 'string') {
    throw new Error(`Invalid or missing MIME type: "${mimeType}"`);
  }
  const normalized = mimeType.toLowerCase().trim();
  const ext = MIME_TO_EXTENSION[normalized];
  if (!ext) {
    throw new Error(
      `Unsupported output format: "${mimeType}". PixelTruth only produces JPEG, PNG, or WebP outputs.`
    );
  }
  return ext;
}

/**
 * Computes the correct output filename based on the original filename
 * and the actual generated Blob's MIME type.
 *
 * - Strips any previous extension (e.g. .heic, .HEIF, .jpeg, .png, .webp)
 * - Replaces with the exact extension for the blob MIME type
 * - Works safely for files without extension or files with multiple dots
 *
 * @param {string} originalName
 * @param {string} blobMimeType
 * @returns {string}
 */
export function getOutputFilename(originalName, blobMimeType) {
  const ext = resolveOutputExtension(blobMimeType);
  if (!originalName || typeof originalName !== 'string') {
    return `cleaned-image${ext}`;
  }

  // Find last dot for extension
  const lastDotIndex = originalName.lastIndexOf('.');
  // If dot exists and is not the very first character (hidden file like .gitignore)
  const base = lastDotIndex > 0 ? originalName.slice(0, lastDotIndex) : originalName;
  return `${base}${ext}`;
}

/**
 * Check if a file or object represents a HEIC/HEIF image.
 * @param {{ type?: string, name?: string }} file
 * @returns {boolean}
 */
export function isHeic(file) {
  if (!file) return false;
  const type = (file.type || '').toLowerCase();
  const name = (file.name || '').toLowerCase();
  return (
    type === 'image/heic' ||
    type === 'image/heif' ||
    /\.hei[cf]$/i.test(name)
  );
}
