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
 * Generates an accurate, granular privacy risk analysis report.
 * @param {Object} metadata
 * @returns {{ level: 'high'|'medium'|'low', score: number, risks: Array<{ category: string, severity: 'critical'|'high'|'medium'|'low', description: string, tag: string }> }}
 */
export function getDetailedPrivacyReport(metadata = {}) {
  const risks = [];
  let score = 0;

  // GPS Geolocation
  const hasGps = ['GPSLatitude', 'GPSLongitude', 'latitude', 'longitude'].some(
    (tag) => metadata[tag] !== undefined && metadata[tag] !== null && metadata[tag] !== ''
  );
  if (hasGps) {
    risks.push({
      category: 'GPS Geolocation',
      severity: 'critical',
      description: 'Physical coordinates pinpoint the exact location where this photo was taken.',
      tag: 'GPSLatitude / GPSLongitude',
    });
    score += 60;
  }

  // Serial Numbers
  const serialTag = ['SerialNumber', 'LensSerialNumber'].find(
    (tag) => metadata[tag] !== undefined && metadata[tag] !== null && metadata[tag] !== ''
  );
  if (serialTag) {
    risks.push({
      category: 'Device Serial Number',
      severity: 'high',
      description: 'Unique hardware serial number can link multiple anonymous photos back to your camera.',
      tag: serialTag,
    });
    score += 25;
  }

  // Personal Identifiers
  const personalTag = ['OwnerName', 'Artist', 'Copyright'].find(
    (tag) => metadata[tag] !== undefined && metadata[tag] !== null && metadata[tag] !== ''
  );
  if (personalTag) {
    risks.push({
      category: 'Creator / Owner Identity',
      severity: 'high',
      description: 'Your personal name or legal copyright is embedded in the image.',
      tag: personalTag,
    });
    score += 20;
  }

  // Timestamps
  const timeTag = ['DateTimeOriginal', 'DateTimeDigitized', 'CreateDate'].find(
    (tag) => metadata[tag] !== undefined && metadata[tag] !== null && metadata[tag] !== ''
  );
  if (timeTag) {
    risks.push({
      category: 'Capture Timestamp',
      severity: 'medium',
      description: 'Exact date and time stamp can reveal your timeline and daily routine.',
      tag: timeTag,
    });
    score += 15;
  }

  // Device & Software
  const deviceTag = ['Make', 'Model', 'LensModel', 'Software'].find(
    (tag) => metadata[tag] !== undefined && metadata[tag] !== null && metadata[tag] !== ''
  );
  if (deviceTag) {
    risks.push({
      category: 'Device & Software Profile',
      severity: 'low',
      description: 'Camera manufacturer, model, and editing software build identifiers.',
      tag: deviceTag,
    });
    score += 10;
  }

  // Normalization
  score = Math.min(100, score);
  const level = score >= 50 ? 'high' : score > 0 ? 'medium' : 'low';

  return {
    level,
    score,
    risks,
  };
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
