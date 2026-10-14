/**
 * Formatting and extraction utilities for image metadata.
 * Provides photography-standard representations for technical tags,
 * accurate GPS coordinate translations, and metadata export helpers.
 */

/**
 * Converts decimal degrees to Degrees, Minutes, Seconds (DMS) format.
 * @param {number} deg
 * @param {boolean} isLat - true for Latitude (N/S), false for Longitude (E/W)
 * @returns {string} e.g. "37° 46' 29.7\" N"
 */
export function formatDms(deg, isLat) {
  if (typeof deg !== 'number' || isNaN(deg)) return '';
  const direction = isLat ? (deg >= 0 ? 'N' : 'S') : (deg >= 0 ? 'E' : 'W');
  const absDeg = Math.abs(deg);
  const d = Math.floor(absDeg);
  const minFloat = (absDeg - d) * 60;
  const m = Math.floor(minFloat);
  const s = ((minFloat - m) * 60).toFixed(1);
  return `${d}° ${m}' ${s}" ${direction}`;
}

/**
 * Formats fractional shutter speeds from numeric exposure times.
 * e.g. 0.004 -> "1/250s", 0.03333 -> "1/30s", 2 -> "2s"
 * @param {number} seconds
 * @returns {string}
 */
export function formatExposureTime(seconds) {
  if (typeof seconds !== 'number' || seconds <= 0) return String(seconds);
  if (seconds >= 1) {
    return `${Number.isInteger(seconds) ? seconds : seconds.toFixed(1)}s`;
  }
  const reciprocal = Math.round(1 / seconds);
  return `1/${reciprocal}s`;
}

/**
 * Formats aperture values (F-number).
 * e.g. 1.8 -> "f/1.8", 2.8 -> "f/2.8"
 * @param {number} fnumber
 * @returns {string}
 */
export function formatFNumber(fnumber) {
  if (typeof fnumber !== 'number' || fnumber <= 0) return String(fnumber);
  return `f/${Number.isInteger(fnumber) ? fnumber : fnumber.toFixed(1)}`;
}

/**
 * EXIF Exposure Program code map.
 */
const EXPOSURE_PROGRAMS = {
  0: 'Not defined',
  1: 'Manual',
  2: 'Normal program',
  3: 'Aperture priority',
  4: 'Shutter priority',
  5: 'Creative program (depth of field)',
  6: 'Action program (fast shutter)',
  7: 'Portrait mode',
  8: 'Landscape mode',
};

/**
 * EXIF Metering Mode code map.
 */
const METERING_MODES = {
  0: 'Unknown',
  1: 'Average',
  2: 'Center-weighted average',
  3: 'Spot',
  4: 'Multi-spot',
  5: 'Pattern / Multi-segment',
  6: 'Partial',
  255: 'Other',
};

/**
 * EXIF Orientation descriptions.
 */
const ORIENTATION_DESCRIPTIONS = {
  1: 'Normal (0°)',
  2: 'Mirrored horizontal',
  3: 'Rotated 180°',
  4: 'Mirrored vertical',
  5: 'Mirrored horizontal & rotated 270° CW',
  6: 'Rotated 90° CW',
  7: 'Mirrored horizontal & rotated 90° CW',
  8: 'Rotated 270° CW',
};

/**
 * Formats a metadata tag value cleanly for human inspection.
 * @param {string} key - Metadata tag name
 * @param {*} value - Raw tag value
 * @returns {string}
 */
export function formatTagValue(key, value) {
  if (value === undefined || value === null) return '—';
  if (value instanceof Date) return value.toLocaleString();

  // JFIF header tags
  if (key === 'JFIFVersion' && typeof value === 'number') {
    const major = (value >> 8) & 0xff;
    const minor = value & 0xff;
    return `${major}.${String(minor).padStart(2, '0')}`;
  }
  if (key === 'ResolutionUnit' && typeof value === 'number') {
    return ['None', 'inches', 'cm'][value] ?? String(value);
  }

  // Camera technical tags
  if (key === 'ExposureTime' && typeof value === 'number') {
    return formatExposureTime(value);
  }
  if ((key === 'FNumber' || key === 'ApertureValue') && typeof value === 'number') {
    return formatFNumber(value);
  }
  if (key === 'FocalLength' && typeof value === 'number') {
    return `${Number.isInteger(value) ? value : value.toFixed(1)} mm`;
  }
  if (key === 'FocalLengthIn35mmFormat' && typeof value === 'number') {
    return `${value} mm (35mm equivalent)`;
  }
  if ((key === 'ISO' || key === 'ISOSpeedRatings') && typeof value === 'number') {
    return `ISO ${value}`;
  }
  if (key === 'ExposureProgram' && typeof value === 'number') {
    return EXPOSURE_PROGRAMS[value] || `Code ${value}`;
  }
  if (key === 'MeteringMode' && typeof value === 'number') {
    return METERING_MODES[value] || `Code ${value}`;
  }
  if (key === 'WhiteBalance' && typeof value === 'number') {
    return value === 0 ? 'Auto' : value === 1 ? 'Manual' : `Code ${value}`;
  }
  if (key === 'Orientation' && typeof value === 'number') {
    return ORIENTATION_DESCRIPTIONS[value] || `Orientation ${value}`;
  }
  if (key === 'ColorSpace') {
    if (value === 1 || value === 'sRGB') return 'sRGB';
    if (value === 65535 || value === 0xffff || value === 'Uncalibrated') return 'Uncalibrated / Adobe RGB';
    return String(value);
  }
  if (key === 'Flash' && typeof value === 'number') {
    if (value === 0) return 'No Flash';
    if (value === 1) return 'Fired';
    if (value === 16) return 'Did not fire (forced off)';
    if (value === 24) return 'Did not fire (auto)';
    if (value === 25) return 'Fired (auto)';
    return (value & 1) ? 'Flash fired' : 'Flash did not fire';
  }

  // GPS coordinates
  if (['GPSLatitude', 'latitude'].includes(key) && typeof value === 'number') {
    return `${value.toFixed(6)}° (${formatDms(value, true)})`;
  }
  if (['GPSLongitude', 'longitude'].includes(key) && typeof value === 'number') {
    return `${value.toFixed(6)}° (${formatDms(value, false)})`;
  }
  if (key === 'GPSAltitude' && typeof value === 'number') {
    const feet = (value * 3.28084).toFixed(0);
    return `${value.toFixed(1)} m (${feet} ft) above sea level`;
  }

  // Generic objects / arrays
  if (typeof value === 'object') {
    try {
      return JSON.stringify(value);
    } catch {
      return String(value);
    }
  }

  if (typeof value === 'number') {
    if (Math.abs(value) < 200 && value % 1 !== 0) {
      return value.toFixed(6);
    }
    return value.toString();
  }

  return String(value);
}

/**
 * Extracts GPS details from metadata if present.
 * @param {Object} metadata
 * @returns {{ hasGps: boolean, latitude: number|null, longitude: number|null, formattedCoords: string, altitude: string|null, mapUrl: string|null }}
 */
export function extractGpsInfo(metadata) {
  if (!metadata || typeof metadata !== 'object') {
    return { hasGps: false, latitude: null, longitude: null, formattedCoords: '', altitude: null, mapUrl: null };
  }

  const rawLat = metadata.latitude ?? metadata.GPSLatitude;
  const rawLon = metadata.longitude ?? metadata.GPSLongitude;

  if (typeof rawLat !== 'number' || typeof rawLon !== 'number' || isNaN(rawLat) || isNaN(rawLon)) {
    return { hasGps: false, latitude: null, longitude: null, formattedCoords: '', altitude: null, mapUrl: null };
  }

  const formattedCoords = `${formatDms(rawLat, true)}, ${formatDms(rawLon, false)}`;
  const mapUrl = `https://www.openstreetmap.org/?mlat=${rawLat.toFixed(5)}&mlon=${rawLon.toFixed(5)}#map=16/${rawLat.toFixed(5)}/${rawLon.toFixed(5)}`;

  let altitude = null;
  const rawAlt = metadata.GPSAltitude ?? metadata.altitude;
  if (typeof rawAlt === 'number') {
    altitude = `${rawAlt.toFixed(1)} m (${(rawAlt * 3.28084).toFixed(0)} ft)`;
  }

  return {
    hasGps: true,
    latitude: rawLat,
    longitude: rawLon,
    formattedCoords,
    altitude,
    mapUrl,
  };
}

/**
 * Exports metadata as a formatted JSON file download.
 * @param {string} originalName - Original filename
 * @param {Object} metadata - Metadata object
 */
export function exportMetadataToJson(originalName, metadata) {
  if (!metadata) return;

  // Filter out internal keys like __c2pa
  const cleanExport = {};
  for (const [key, val] of Object.entries(metadata)) {
    if (key.startsWith('__')) continue;
    cleanExport[key] = val;
  }

  if (Array.isArray(metadata.__c2pa) && metadata.__c2pa.length > 0) {
    cleanExport.contentCredentials = metadata.__c2pa.map(([label, val]) => ({ [label]: val }));
  }

  const jsonStr = JSON.stringify(cleanExport, null, 2);
  const blob = new Blob([jsonStr], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  
  const baseName = originalName ? originalName.replace(/\.[^/.]+$/, '') : 'image';
  const a = document.createElement('a');
  a.href = url;
  a.download = `${baseName}_metadata.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Generates formatted text for clipboard copying.
 * @param {string} filename
 * @param {Object} metadata
 * @returns {string}
 */
export function formatMetadataForClipboard(filename, metadata) {
  if (!metadata) return '';
  const lines = [`=== Metadata: ${filename} ===`];

  for (const [key, val] of Object.entries(metadata)) {
    if (key.startsWith('__') || val === undefined || val === null || val === '') continue;
    lines.push(`${key}: ${formatTagValue(key, val)}`);
  }

  if (Array.isArray(metadata.__c2pa) && metadata.__c2pa.length > 0) {
    lines.push('\n--- Content Credentials (C2PA) ---');
    for (const [label, val] of metadata.__c2pa) {
      lines.push(`${label}: ${val}`);
    }
  }

  return lines.join('\n');
}
