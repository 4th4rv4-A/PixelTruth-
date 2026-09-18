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
  if (metadata.latitude || metadata.longitude || metadata.GPSLatitude || metadata.GPSLongitude) {
    return 'high';
  }
  if (metadata.Make || metadata.Model || metadata.Software || metadata.LensMake || metadata.LensModel) {
    return 'medium';
  }
  return 'low';
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
