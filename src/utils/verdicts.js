/**
 * Centralized constants for C2PA Provenance state.
 */
export const PROVENANCE_STATE = {
  NO_PROVENANCE: 'NO_PROVENANCE',
  PRESENT_UNVALIDATED: 'PROVENANCE_PRESENT_UNVALIDATED',
  VALID: 'PROVENANCE_VALID',
  TRUSTED: 'PROVENANCE_TRUSTED',
  SIGNED_AI: 'SIGNED_AI_PROVENANCE',
};

/**
 * Centralized constants for AI Inference state.
 */
export const AI_SIGNAL_STATE = {
  NO_SIGNAL: 'NO_AI_SIGNAL',
  SOFTWARE_SIGNAL: 'AI_SOFTWARE_SIGNAL',
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
  POSSIBLE: 'possible', // Corresponds to AI_SOFTWARE_SIGNAL / METADATA_SIGNAL
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
