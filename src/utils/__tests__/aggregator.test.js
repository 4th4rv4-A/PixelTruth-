import { describe, it, expect } from 'vitest';
import { aggregateSignals, OVERALL_ASSESSMENTS } from '../aggregator';
import { PROVENANCE_STATE } from '../verdicts';

describe('C2PA Trust Semantics Test Matrix', () => {
  it('1. no credential', () => {
    const result = aggregateSignals({ c2pa: null });
    expect(result.overallAssessment).toBe(OVERALL_ASSESSMENTS.NO_SIGNIFICANT_SIGNAL);
  });

  it('2. malformed credential / tampered', () => {
    const input = {
      c2pa: { provenance: PROVENANCE_STATE.CREDENTIAL_PRESENT_INVALID, validationIssues: [{ code: 'validation.signature.tampered' }] }
    };
    const result = aggregateSignals(input);
    expect(result.overallAssessment).toBe(OVERALL_ASSESSMENTS.TAMPERED_PROVENANCE);
    expect(result.humanReasoning).toContain('validation.signature.tampered');
  });

  it('3. valid manifest, no trust established', () => {
    const input = {
      c2pa: { provenance: PROVENANCE_STATE.CREDENTIAL_VALID_UNTRUSTED, hasCryptographicAiAction: false, issuer: 'Unknown' }
    };
    const result = aggregateSignals(input);
    expect(result.overallAssessment).toBe(OVERALL_ASSESSMENTS.UNTRUSTED_PROVENANCE_NO_AI_ASSERTION);
    expect(result.humanReasoning).toContain('Trust is not established');
  });

  it('4. trusted credential', () => {
    const input = {
      c2pa: { provenance: PROVENANCE_STATE.CREDENTIAL_VALID_TRUSTED, hasCryptographicAiAction: false, issuer: 'Sony' }
    };
    const result = aggregateSignals(input);
    expect(result.overallAssessment).toBe(OVERALL_ASSESSMENTS.TRUSTED_PROVENANCE_NO_AI_ASSERTION);
  });

  it('5. untrusted credential with AI action', () => {
    const input = {
      c2pa: { provenance: PROVENANCE_STATE.CREDENTIAL_VALID_UNTRUSTED, hasCryptographicAiAction: true, issuer: 'Unknown AI' }
    };
    const result = aggregateSignals(input);
    expect(result.overallAssessment).toBe(OVERALL_ASSESSMENTS.UNTRUSTED_SIGNED_AI_PROVENANCE);
  });

  it('6. trusted credential with AI action', () => {
    const input = {
      c2pa: { provenance: PROVENANCE_STATE.CREDENTIAL_VALID_TRUSTED, hasCryptographicAiAction: true, issuer: 'Adobe' }
    };
    const result = aggregateSignals(input);
    expect(result.overallAssessment).toBe(OVERALL_ASSESSMENTS.VERIFIED_SIGNED_AI_PROVENANCE);
  });

  it('7. software metadata AI marker only', () => {
    const input = {
      c2pa: null,
      metadata: { hasAiSoftwareMarker: true, raw: 'Midjourney' }
    };
    const result = aggregateSignals(input);
    expect(result.overallAssessment).toBe(OVERALL_ASSESSMENTS.AI_TOOL_INDICATOR);
  });

  it('8. conflicting software metadata + C2PA evidence (trusted NO AI overrides software AI)', () => {
    const input = {
      c2pa: { provenance: PROVENANCE_STATE.CREDENTIAL_VALID_TRUSTED, hasCryptographicAiAction: false, issuer: 'Canon' },
      metadata: { hasAiSoftwareMarker: true, raw: 'Photoshop (AI)' }
    };
    const result = aggregateSignals(input);
    expect(result.overallAssessment).toBe(OVERALL_ASSESSMENTS.TRUSTED_PROVENANCE_NO_AI_ASSERTION);
  });

  it('9. invalid/tampered validation', () => {
    const input = {
      c2pa: { provenance: PROVENANCE_STATE.CREDENTIAL_PRESENT_INVALID, validationIssues: [{ code: 'validation.manifest.mismatch' }] }
    };
    const result = aggregateSignals(input);
    expect(result.overallAssessment).toBe(OVERALL_ASSESSMENTS.TAMPERED_PROVENANCE);
  });

  it('10. credential present but validation information unavailable', () => {
    const input = {
      c2pa: { provenance: PROVENANCE_STATE.CREDENTIAL_PRESENT_INVALID, validationIssues: [] }
    };
    const result = aggregateSignals(input);
    expect(result.overallAssessment).toBe(OVERALL_ASSESSMENTS.TAMPERED_PROVENANCE);
  });
});
