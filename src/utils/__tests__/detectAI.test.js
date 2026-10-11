import { describe, it, expect, vi } from 'vitest';
import { detectAI } from '../detectAI';
import { PROVENANCE_STATE, AI_SIGNAL_STATE } from '../verdicts';
import { OVERALL_ASSESSMENTS } from '../aggregator';
import { c2paPool } from '../../workers/instances';

vi.mock('../../workers/instances', () => ({
  c2paPool: {
    dispatch: vi.fn()
  }
}));

describe('detectAI', () => {
  it('Case A: provenance CREDENTIAL_VALID_UNTRUSTED, aiSignal SOFTWARE_INDICATOR, generator Midjourney', async () => {
    c2paPool.dispatch.mockResolvedValueOnce({
      provenance: PROVENANCE_STATE.CREDENTIAL_VALID_UNTRUSTED,
      aiSignal: AI_SIGNAL_STATE.SOFTWARE_INDICATOR,
      generator: 'Midjourney'
    });

    const file = new File([''], 'dummy.jpg', { type: 'image/jpeg' });
    const result = await detectAI(file);
    
    expect(result.metadataSignals).toHaveLength(1);
    expect(result.metadataSignals[0].type).toBe('AI_SOFTWARE_MARKER');
  });

  it('Case B: provenance NO_CREDENTIAL', async () => {
    c2paPool.dispatch.mockResolvedValueOnce({
      provenance: PROVENANCE_STATE.NO_CREDENTIAL,
      aiSignal: AI_SIGNAL_STATE.NO_SIGNAL
    });

    const file = new File([''], 'dummy.jpg', { type: 'image/jpeg' });
    const result = await detectAI(file);
    
    expect(result.overallAssessment).toBe(OVERALL_ASSESSMENTS.NO_SIGNIFICANT_SIGNAL);
  });

  it('Case C: dispatch throws a non-cancel error', async () => {
    c2paPool.dispatch.mockRejectedValueOnce(new Error('Some error'));

    const file = new File([''], 'dummy.jpg', { type: 'image/jpeg' });
    const result = await detectAI(file);
    
    expect([OVERALL_ASSESSMENTS.INCONCLUSIVE, OVERALL_ASSESSMENTS.NO_SIGNIFICANT_SIGNAL]).toContain(result.overallAssessment);
  });
});
