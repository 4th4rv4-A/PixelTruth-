import { imagePool } from '../workers/instances';

/**
 * Parse EXIF, GPS, and IFD0 metadata from an image file using Web Worker.
 * @param {File} file
 * @param {AbortSignal} [signal] Optional cancellation signal
 * @returns {Promise<Object>} parsed metadata or empty object
 */
export async function readMetadata(file, signal) {
  try {
    // We pass the File object directly. postMessage uses structural cloning
    // which for Blobs/Files is passed by reference (zero-copy memory).
    const result = await imagePool.dispatch('READ_METADATA', {
      file
    }, {
      signal
    });
    
    return result || {};
  } catch (err) {
    if (err.message === 'CANCELLED') {
      throw err;
    }
    console.warn(`[PixelTruth] readMetadata failed for ${file.name}:`, err);
    return {};
  }
}

/**
 * Determine privacy risk level based on metadata contents.
 * @param {Object} metadata
 * @returns {'high'|'medium'|'low'}
 */
export function getPrivacyLevel(metadata) {
  let level = 'low';
  for (const tag of SENSITIVE_TAGS) {
    if (metadata[tag] !== undefined && metadata[tag] !== null && metadata[tag] !== '') {
      if (['GPSLatitude', 'GPSLongitude', 'latitude', 'longitude'].includes(tag)) {
        return 'high'; // Highest possible, return immediately
      }
      level = 'medium';
    }
  }
  return level;
}

/**
 * Whitelist of tags preserved by format during lossless stripping.
 * - JPEG preserves Orientation, ColorSpace, and ICC_Profile (APP2).
 * - PNG / WebP preserve ICC_Profile (iCCP / ICCP chunk).
 */
export const PRESERVED_TAGS_BY_MIME = {
  'image/jpeg': ['Orientation', 'ColorSpace', 'ICC_Profile'],
  'image/png': ['ICC_Profile'],
  'image/webp': ['ICC_Profile'],
};

export const ALWAYS_KEEP_TAGS = ['Orientation', 'ColorSpace', 'ICC_Profile'];

/**
 * Checks whether a tag is guaranteed to be preserved for the given MIME type / format.
 */
export function isTagAlwaysKept(tag, mimeType = 'image/jpeg') {
  const allowed = PRESERVED_TAGS_BY_MIME[mimeType] || ['ICC_Profile'];
  return allowed.includes(tag);
}


/**
 * Tags considered sensitive / privacy-relevant.
 */
const SENSITIVE_TAGS = [
  'GPSLatitude', 'GPSLongitude', 'GPSAltitude', 'GPSDateStamp', 'GPSTimeStamp',
  'latitude', 'longitude',
  'Make', 'Model', 'LensMake', 'LensModel',
  'Software', 'HostComputer',
  'DateTimeOriginal', 'DateTimeDigitized', 'CreateDate', 'ModifyDate',
  'SerialNumber', 'LensSerialNumber',
  'OwnerName', 'Artist', 'Copyright',
  'ImageDescription', 'UserComment',
];
