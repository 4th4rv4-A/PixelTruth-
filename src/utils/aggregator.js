import { PROVENANCE_STATE } from './verdicts';

export const OVERALL_ASSESSMENTS = {
  VERIFIED_SIGNED_AI_PROVENANCE: 'VERIFIED_SIGNED_AI_PROVENANCE',
  TRUSTED_PROVENANCE_NO_AI_ASSERTION: 'TRUSTED_PROVENANCE_NO_AI_ASSERTION',
  AI_TOOL_INDICATOR: 'AI_TOOL_INDICATOR',
  MULTIPLE_SYNTHETIC_SIGNALS: 'MULTIPLE_SYNTHETIC_SIGNALS',
  NO_SIGNIFICANT_SIGNAL: 'NO_SIGNIFICANT_SIGNAL',
  INCONCLUSIVE: 'INCONCLUSIVE'
};

/**
 * Deterministically aggregates multiple diagnostic signals into a structured verdict model.
 * 
 * @param {Object} input 
 * @param {Object} input.c2pa - { provenanceState, issuer, generator, validationNote, ... }
 * @param {Object} input.metadata - { hasAiSoftwareMarker, raw, software }
 * @param {Object} input.ela - { maxDifference }
 * @param {Object} input.fft - { maxMagnitude }
 * @param {Object} input.model - { syntheticLikelihood, signalStrength }
 * @returns {Object} Structured verdict model
 */
export function aggregateSignals(input) {
  const { c2pa, metadata, ela, fft, model } = input;

  const result = {
    provenance: c2pa || {},
    metadataSignals: [],
    forensicSignals: [],
    modelSignals: [],
    overallAssessment: OVERALL_ASSESSMENTS.INCONCLUSIVE,
    humanReasoning: '',
    limitations: [
      'Visual forensics (ELA/FFT) highlight structural anomalies, not definitive proof of manipulation.',
      'AI models are heuristic and subject to adversarial noise or unseen generators.'
    ]
  };

  // 1. Collect Signals
  if (metadata?.hasAiSoftwareMarker) {
    result.metadataSignals.push({
      type: 'AI_SOFTWARE_MARKER',
      description: `Unsigned metadata mentions an AI tool: ${metadata.raw || metadata.software}`
    });
  }

  if (ela?.maxDifference > 100) { // Arbitrary threshold for "high" difference
    result.forensicSignals.push({
      type: 'ELEVATED_COMPRESSION_DIFFERENCE',
      description: 'ELA detected elevated local compression differences.'
    });
  }

  if (fft?.maxMagnitude > 15) { // Arbitrary threshold
    result.forensicSignals.push({
      type: 'FREQUENCY_ANOMALY',
      description: '2D FFT detected significant repeating frequency structures.'
    });
  }

  if (model?.signalStrength === 'HIGH' || model?.syntheticLikelihood > 0.8) {
    result.modelSignals.push({
      type: 'HIGH_SYNTHETIC_LIKELIHOOD',
      description: `Local AI model produced a high synthetic likelihood (${(model.syntheticLikelihood * 100).toFixed(1)}%).`
    });
  }

  const hasMetadataSignal = result.metadataSignals.length > 0;
  const numHeuristics = result.forensicSignals.length + result.modelSignals.length;

  // 2. Evaluate Cryptographic Ground Truth (Overrides all heuristics)
  if (c2pa) {
    if (c2pa.provenanceState === PROVENANCE_STATE.SIGNED_AI) {
      result.overallAssessment = OVERALL_ASSESSMENTS.VERIFIED_SIGNED_AI_PROVENANCE;
      result.humanReasoning = `Signed AI provenance was found in a valid trusted manifest from ${c2pa.issuer}.`;
      return result;
    } 
    
    if (c2pa.provenanceState === PROVENANCE_STATE.TRUSTED) {
      result.overallAssessment = OVERALL_ASSESSMENTS.TRUSTED_PROVENANCE_NO_AI_ASSERTION;
      result.humanReasoning = `A valid provenance credential was found from ${c2pa.issuer}, and it explicitly lacks signed AI-generation assertions.`;
      return result;
    }

    if (c2pa.validationNote && c2pa.provenanceState === PROVENANCE_STATE.PRESENT_UNVALIDATED) {
      // It has C2PA but it failed validation. 
      // We fall through to heuristics, but note it.
      result.metadataSignals.push({
        type: 'TAMPERED_PROVENANCE',
        description: c2pa.validationNote
      });
    }
  }

  // 3. Evaluate Unverified Clues and Diagnostics
  if (hasMetadataSignal) {
    result.overallAssessment = OVERALL_ASSESSMENTS.AI_TOOL_INDICATOR;
    result.humanReasoning = 'An AI-associated software marker was found in metadata, but no cryptographically verified AI provenance was found. This data is unverified and easily spoofed.';
    return result;
  }

  if (numHeuristics >= 2) {
    result.overallAssessment = OVERALL_ASSESSMENTS.MULTIPLE_SYNTHETIC_SIGNALS;
    result.humanReasoning = 'Multiple diagnostic heuristics produced synthetic-image signals. However, no verifiable cryptographic provenance confirms this origin.';
    return result;
  }

  if (numHeuristics === 1) {
    result.overallAssessment = OVERALL_ASSESSMENTS.INCONCLUSIVE;
    if (result.modelSignals.length > 0) {
      result.humanReasoning = 'Local model analysis produced a synthetic-image signal, but no other corroborating signals or provenance information was available.';
    } else {
      result.humanReasoning = 'A single visual forensic anomaly was detected, which often occurs naturally due to sharp edges or upscaling. Insufficient evidence to determine origin.';
    }
    return result;
  }

  // 4. No signals
  result.overallAssessment = OVERALL_ASSESSMENTS.NO_SIGNIFICANT_SIGNAL;
  result.humanReasoning = 'No significant AI-generation signal was detected by the currently enabled checks. Note: This does not prove the image is authentic.';
  return result;
}
