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
    removeTimestamps: policy.removeTimestamps ?? true,
    removeIcc: policy.removeIcc ?? (isFullSanitize ? true : false),
    preserveOrientation: policy.preserveOrientation ?? true,
    preserveColorSpace: policy.preserveColorSpace ?? true,
    // C2PA / JUMBF Content Credentials are stripped by default on every clean.
    removeC2pa: policy.removeC2pa ?? true,
    keepTags: Array.isArray(policy.keepTags) ? policy.keepTags : [],
    fullSanitize: isFullSanitize,
  };

  return normalized;
}

/**
 * Common result object constructor for binary carvers.
 */
export function createResult({
  format,
  inputFormat = format,
  outputFormat = format,
  mimeType = null,
  isLossless = true,
  inputBytes,
  outputBytes = null,
  removedSegments = [],
  preservedSegments = [],
  imageBitstreamChanged = false,
  warnings = [],
  error = null,
  status = 'success', // 'success', 'unsupported', 'malformed', 'unsafe', 'fallback-required'
}) {
  const resolvedMime = mimeType || (
    outputFormat === 'jpeg' ? 'image/jpeg' :
    outputFormat === 'png' ? 'image/png' :
    outputFormat === 'webp' ? 'image/webp' :
    outputFormat === 'gif' ? 'image/gif' :
    outputFormat === 'avif' ? 'image/avif' :
    outputFormat === 'mp4' ? 'video/mp4' :
    outputFormat === 'mov' ? 'video/quicktime' :
    outputFormat === 'pdf' ? 'application/pdf' :
    'application/octet-stream'
  );

  return {
    format: outputFormat || format,
    inputFormat: inputFormat || format,
    outputFormat: outputFormat || format,
    mimeType: resolvedMime,
    isLossless,
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
      return new Blob([outputBytes], { type: resolvedMime });
    },
  };
}
