import { describe, it, expect } from 'vitest';
import { aggregateSignals, OVERALL_ASSESSMENTS } from '../aggregator';
import { PROVENANCE_STATE } from '../verdicts';

describe('aggregateSignals Deterministic Logic', () => {
  it('returns NO_SIGNIFICANT_SIGNAL when no signals are present', () => {
    const input = {
      c2pa: null,
      metadata: null,
      ela: null,
      fft: null,
      model: null
    };
    const result = aggregateSignals(input);
    expect(result.overallAssessment).toBe(OVERALL_ASSESSMENTS.NO_SIGNIFICANT_SIGNAL);
    expect(result.humanReasoning).toContain('No significant AI-generation signal');
  });

  it('prioritizes SIGNED_AI over all other heuristics', () => {
    const input = {
      c2pa: { provenanceState: PROVENANCE_STATE.SIGNED_AI, issuer: 'Adobe' },
      metadata: { hasAiSoftwareMarker: false },
      ela: { maxDifference: 200 },
      model: { syntheticLikelihood: 0.9, signalStrength: 'HIGH' }
    };
    const result = aggregateSignals(input);
    expect(result.overallAssessment).toBe(OVERALL_ASSESSMENTS.VERIFIED_SIGNED_AI_PROVENANCE);
    expect(result.humanReasoning).toContain('Signed AI provenance was found in a valid trusted manifest from Adobe');
  });

  it('prioritizes TRUSTED_PROVENANCE_NO_AI_ASSERTION when camera hardware signs it', () => {
    const input = {
      c2pa: { provenanceState: PROVENANCE_STATE.TRUSTED, issuer: 'Sony' },
      model: { syntheticLikelihood: 0.99, signalStrength: 'HIGH' } // Even if model flags it
    };
    const result = aggregateSignals(input);
    expect(result.overallAssessment).toBe(OVERALL_ASSESSMENTS.TRUSTED_PROVENANCE_NO_AI_ASSERTION);
    expect(result.humanReasoning).toContain('explicitly lacks signed AI-generation assertions');
  });

  it('returns AI_TOOL_INDICATOR if metadata implies AI but no signed provenance exists', () => {
    const input = {
      c2pa: null,
      metadata: { hasAiSoftwareMarker: true, raw: 'Midjourney v6' },
      model: null
    };
    const result = aggregateSignals(input);
    expect(result.overallAssessment).toBe(OVERALL_ASSESSMENTS.AI_TOOL_INDICATOR);
    expect(result.metadataSignals).toHaveLength(1);
    expect(result.metadataSignals[0].description).toContain('Midjourney v6');
  });

  it('returns MULTIPLE_SYNTHETIC_SIGNALS if ELA and Model both flag anomalies', () => {
    const input = {
      c2pa: null,
      metadata: null,
      ela: { maxDifference: 150 },
      model: { syntheticLikelihood: 0.85, signalStrength: 'HIGH' }
    };
    const result = aggregateSignals(input);
    expect(result.overallAssessment).toBe(OVERALL_ASSESSMENTS.MULTIPLE_SYNTHETIC_SIGNALS);
    expect(result.humanReasoning).toContain('Multiple diagnostic heuristics produced synthetic-image signals');
  });

  it('returns INCONCLUSIVE for a model-only signal', () => {
    const input = {
      model: { syntheticLikelihood: 0.9, signalStrength: 'HIGH' }
    };
    const result = aggregateSignals(input);
    expect(result.overallAssessment).toBe(OVERALL_ASSESSMENTS.INCONCLUSIVE);
    expect(result.humanReasoning).toContain('Local model analysis produced a synthetic-image signal');
  });

  it('returns INCONCLUSIVE for an ELA-only signal', () => {
    const input = {
      ela: { maxDifference: 250 }
    };
    const result = aggregateSignals(input);
    expect(result.overallAssessment).toBe(OVERALL_ASSESSMENTS.INCONCLUSIVE);
    expect(result.humanReasoning).toContain('A single visual forensic anomaly was detected');
  });

  it('returns INCONCLUSIVE for an FFT-only signal', () => {
    const input = {
      fft: { maxMagnitude: 20 }
    };
    const result = aggregateSignals(input);
    expect(result.overallAssessment).toBe(OVERALL_ASSESSMENTS.INCONCLUSIVE);
    expect(result.humanReasoning).toContain('A single visual forensic anomaly was detected');
  });
});
