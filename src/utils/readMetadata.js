import exifr from 'exifr';

/**
 * Parse EXIF, GPS, and IFD0 metadata from an image file.
 * @param {File} file
 * @returns {Promise<Object>} parsed metadata or empty object
 */
export async function readMetadata(file) {
  try {
    const data = await exifr.parse(file, {
      gps: true,
      exif: true,
      ifd0: true,
      iptc: true,
      xmp: true,
      tiff: true,
      translateKeys: true,
      translateValues: true,
      reviveValues: true,
    });
    return data || {};
  } catch {
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
 * Tags that should always be preserved for correct image rendering.
 */
export const ALWAYS_KEEP_TAGS = ['Orientation', 'ColorSpace', 'ICC_Profile'];

/**
 * Tags considered sensitive / privacy-relevant.
 */
export const SENSITIVE_TAGS = [
  'GPSLatitude', 'GPSLongitude', 'GPSAltitude', 'GPSDateStamp', 'GPSTimeStamp',
  'latitude', 'longitude',
  'Make', 'Model', 'LensMake', 'LensModel',
  'Software', 'HostComputer',
  'DateTimeOriginal', 'DateTimeDigitized', 'CreateDate', 'ModifyDate',
  'SerialNumber', 'LensSerialNumber',
  'OwnerName', 'Artist', 'Copyright',
  'ImageDescription', 'UserComment',
];
