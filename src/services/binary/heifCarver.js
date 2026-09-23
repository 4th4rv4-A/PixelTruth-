import { createResult } from './policy.js';

/**
 * Stub for HEIF/HEIC sanitization.
 * Binary carving for BMFF boxes is complex and not yet implemented.
 * We safely return 'fallback-required' to route to the heic2any fallback.
 */
export function sanitizeHeif(inputBytes, _policy) {
  return createResult({
    format: 'heic',
    inputBytes,
    status: 'fallback-required',
    error: 'Binary sanitization for HEIC/HEIF is currently unsupported. Fallback required.'
  });
}
