/**
 * Validates and normalizes a sanitization policy object.
 *
 * @param {Object} policy
 * @param {boolean} [policy.removeExif=true]
 * @param {boolean} [policy.removeGps=true]
 * @param {boolean} [policy.removeXmp=true]
 * @param {boolean} [policy.removeIptc=true]
 * @param {boolean} [policy.removeComments=true]
 * @param {boolean} [policy.removeIcc=false] Default false: preserves ICC color profile unless fullSanitize is true
 * @param {boolean} [policy.preserveOrientation=true] Default true: preserves Orientation tag
 * @param {boolean} [policy.preserveColorSpace=true] Default true: preserves ColorSpace tag
 * @param {boolean} [policy.fullSanitize=false] If true, strips ICC color profile as well
 * @returns {Object} normalized policy
 */
export function validatePolicy(policy = {}) {
  const isFullSanitize = policy.fullSanitize ?? false;
  const normalized = {
    removeExif: policy.removeExif ?? true,
    removeGps: policy.removeGps ?? true,
    removeXmp: policy.removeXmp ?? true,
    removeIptc: policy.removeIptc ?? true,
    removeComments: policy.removeComments ?? true,
    removeIcc: policy.removeIcc ?? (isFullSanitize ? true : false),
    preserveOrientation: policy.preserveOrientation ?? true,
    preserveColorSpace: policy.preserveColorSpace ?? true,
    // C2PA / JUMBF Content Credentials are stripped by default on every clean.
    removeC2pa: policy.removeC2pa ?? true,
    fullSanitize: isFullSanitize,
  };

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
