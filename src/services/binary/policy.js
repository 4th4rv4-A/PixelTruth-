/**
 * Validates and normalizes a sanitization policy object.
 *
 * @param {Object} policy
 * @param {boolean} [policy.removeExif=true]
 * @param {boolean} [policy.removeGps=true]
 * @param {boolean} [policy.removeXmp=true]
 * @param {boolean} [policy.removeIptc=true]
 * @param {boolean} [policy.removeComments=true]
 * @param {boolean} [policy.removeIcc=false]
 * @param {boolean} [policy.preserveC2pa=true]
 * @param {boolean} [policy.removeC2pa=false]
 * @returns {Object} normalized policy
 * @throws {Error} if policy combination is invalid
 */
export function validatePolicy(policy = {}) {
  const normalized = {
    removeExif: policy.removeExif ?? true,
    removeGps: policy.removeGps ?? true, // Usually part of EXIF, but explicit intent
    removeXmp: policy.removeXmp ?? true,
    removeIptc: policy.removeIptc ?? true,
    removeComments: policy.removeComments ?? true,
    removeIcc: policy.removeIcc ?? false,
    preserveC2pa: policy.preserveC2pa ?? true,
    removeC2pa: policy.removeC2pa ?? false,
  };

  if (normalized.preserveC2pa && normalized.removeC2pa) {
    throw new Error('Invalid policy: cannot both preserve and remove C2PA.');
  }

  return normalized;
}

/**
 * Common result object constructor for binary carvers.
 */
export function createResult({
  format,
  inputBytes,
  outputBytes = null,
  removedSegments = [],
  preservedSegments = [],
  imageBitstreamChanged = false,
  c2paPreserved = false,
  warnings = [],
  error = null,
  status = 'success', // 'success', 'unsupported', 'malformed', 'unsafe', 'fallback-required'
}) {
  return {
    format,
    inputBytes,
    outputBytes,
    removedSegments,
    preservedSegments,
    imageBitstreamChanged,
    c2paPreserved,
    warnings,
    error,
    status,
    get outputBlob() {
      if (!outputBytes) return null;
      let mimeType = 'application/octet-stream';
      if (format === 'jpeg') mimeType = 'image/jpeg';
      if (format === 'png') mimeType = 'image/png';
      if (format === 'webp') mimeType = 'image/webp';
      return new Blob([outputBytes], { type: mimeType });
    },
  };
}
