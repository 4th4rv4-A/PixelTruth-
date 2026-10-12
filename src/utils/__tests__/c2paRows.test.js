import { describe, it, expect } from 'vitest';
import { flattenC2paRows } from '../c2paRows';

describe('flattenC2paRows', () => {
  it('returns [] for null / absent manifest', () => {
    expect(flattenC2paRows(null)).toEqual([]);
    expect(flattenC2paRows({ present: false })).toEqual([]);
  });

  it('flattens the Google-AI style manifest into rows', () => {
    const rows = flattenC2paRows({
      present: true,
      claimGenerator: 'Google C2PA Core Generator Library',
      instanceId: 'cb54b856-2668-2593-96ea-4ec888982057',
      signatureAlg: 'sha256',
      issuer: 'Google',
      time: '2026-10-11T00:00:00Z',
      actions: [
        { action: 'c2pa.created', description: 'Created by Google Generative AI.', digitalSourceType: 'trainedAlgorithmicMedia' },
        { action: 'c2pa.edited', description: 'Applied imperceptible SynthID watermark.', digitalSourceType: null },
      ],
      validation: [
        { code: 'claimSignature.validated', ok: true },
        { code: 'signingCredential.trusted', ok: true },
      ],
    });
    const tags = rows.map(([t]) => t);
    expect(tags).toContain('Claim Generator');
    expect(tags).toContain('Instance ID');
    expect(tags).toContain('Action 1');
    expect(tags).toContain('Action 2');
    expect(tags.filter((t) => t === 'Validation')).toHaveLength(2);
    expect(rows.find(([t]) => t === 'Claim Generator')[1]).toBe('Google C2PA Core Generator Library');
    const a1 = rows.find(([t]) => t === 'Action 1')[1];
    expect(a1).toContain('Created by Google Generative AI.');
    expect(a1).toContain('trainedAlgorithmicMedia');
  });
});
