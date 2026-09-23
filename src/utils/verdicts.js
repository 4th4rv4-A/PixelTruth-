/**
 * Centralized constants for C2PA Provenance state.
 */
export const PROVENANCE_STATE = {
  NO_CREDENTIAL: 'NO_CREDENTIAL',
  CREDENTIAL_PRESENT_INVALID: 'CREDENTIAL_PRESENT_INVALID',
  CREDENTIAL_VALID_UNTRUSTED: 'CREDENTIAL_VALID_UNTRUSTED',
  CREDENTIAL_VALID_TRUSTED: 'CREDENTIAL_VALID_TRUSTED',
};

/**
 * Centralized constants for AI Inference state.
 */
export const AI_SIGNAL_STATE = {
  NO_SIGNAL: 'NO_AI_SIGNAL',
  SOFTWARE_INDICATOR: 'AI_SOFTWARE_INDICATOR',
  METADATA_SIGNAL: 'AI_METADATA_SIGNAL',
  MODEL_SIGNAL: 'MODEL_SIGNAL', // E.g., if a deep learning model flagged it
};

export { OVERALL_ASSESSMENTS } from './aggregator';

/**
 * Legacy VERDICTS mapped for backward compatibility during transition,
 * or higher-level UI presentation logic.
 */
export const VERDICTS = {
  VERIFIED_AI: 'verified-ai', // Corresponds to SIGNED_AI_PROVENANCE
  VERIFIED_PROVENANCE: 'verified-provenance', // Corresponds to TRUSTED/VALID without AI
  POSSIBLE: 'possible', // Corresponds to AI_SOFTWARE_INDICATOR / METADATA_SIGNAL
  INCONCLUSIVE: 'inconclusive', // NO_PROVENANCE + NO_SIGNAL, or PRESENT_UNVALIDATED
};

/**
 * Determine whether credential details should be displayed in the UI.
 * @param {string|null|undefined} verdict
 * @returns {boolean}
 */
export function shouldShowCredentials(verdict) {
  return verdict === 'VERIFIED_SIGNED_AI_PROVENANCE' || verdict === 'TRUSTED_PROVENANCE_NO_AI_ASSERTION';
}
