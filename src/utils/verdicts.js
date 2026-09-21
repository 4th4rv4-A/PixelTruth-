/**
 * Centralized verdict constants for AI detection results.
 * Used by detectAI.js, VerdictCard.jsx, and CredentialDetails.jsx.
 */
export const VERDICTS = {
  VERIFIED_AI: 'verified-ai',
  VERIFIED_PROVENANCE: 'verified-provenance',
  POSSIBLE: 'possible',
  INCONCLUSIVE: 'inconclusive',
};

/**
 * Determine whether credential details should be displayed.
 * Only verified verdicts (verified-ai, verified-provenance) show credential details.
 * @param {string|null|undefined} verdict
 * @returns {boolean}
 */
export function shouldShowCredentials(verdict) {
  return typeof verdict === 'string' && verdict.startsWith('verified');
}
