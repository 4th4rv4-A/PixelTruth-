import { c2paPool } from '../workers/instances';
import { PROVENANCE_STATE, AI_SIGNAL_STATE } from './verdicts';

import { aggregateSignals } from './aggregator';

/**
 * Check for C2PA Content Credentials in an image file using Web Worker.
 * @param {File} file
 * @param {AbortSignal} [signal]
 * @returns {Promise<Object|null>}
 */
async function checkC2PA(file, signal) {
  try {
    const result = await c2paPool.dispatch('DETECT_AI', {
      file
    }, {
      signal
    });

    return result;
  } catch (err) {
    if (import.meta.env.DEV) console.warn('[PixelTruth] C2PA check failed:', err);
    if (err.message === 'CANCELLED' || err.message === 'TIMEOUT') {
      throw err;
    }
    return null;
  }
}

/**
 * High-level function to evaluate an image for AI generation or tampering.
 * Offloads heavy WASM inspection to a worker.
 * @param {File} file 
 * @param {AbortSignal} [signal]
 * @returns {Promise<Object>}
 */
export async function detectAI(file, signal) {
  try {
    const c2paResult = await checkC2PA(file, signal);
    
    if (c2paResult) {
      let validationNote = null;
      if (c2paResult.provenance === PROVENANCE_STATE.PRESENT_UNVALIDATED) {
        if (c2paResult.validationIssues && c2paResult.validationIssues.length > 0) {
           validationNote = `Credential found but validation failed: ${c2paResult.validationIssues.map(i => i.code).join(', ')}. This indicates tampering or missing trust anchors.`;
        } else {
           validationNote = `Credential found but validation is unavailable.`;
        }
      }

      const input = {
        c2pa: {
          provenanceState: c2paResult.provenance,
          issuer: c2paResult.issuer,
          generator: c2paResult.generator,
          validationNote,
          ...c2paResult
        },
        metadata: c2paResult.aiSignal === AI_SIGNAL_STATE.SOFTWARE_SIGNAL || c2paResult.aiSignal === AI_SIGNAL_STATE.METADATA_SIGNAL 
          ? { hasAiSoftwareMarker: true, raw: c2paResult.raw || c2paResult.generator, software: c2paResult.generator }
          : null
      };

      const structuredVerdict = aggregateSignals(input);
      
      return {
        ...structuredVerdict,
        rawResult: c2paResult // keep original for CredentialDetails if needed
      };
    }

    return aggregateSignals({});
  } catch (error) {
    if (error.message === 'CANCELLED') throw error;
    if (import.meta.env.DEV) console.error('[PixelTruth] detectAI error:', error);
    return aggregateSignals({});
  }
}
