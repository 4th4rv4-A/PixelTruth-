import { describe, it, expect } from 'vitest';
import { generateForensicReport, boundValue, boundMetadataObject } from '../ReportGenerator';

describe('ReportGenerator', () => {

  it('bounds long string values', () => {
    const longString = 'A'.repeat(1000);
    const bounded = boundValue(longString, 50);
    expect(bounded.length).toBeLessThan(1000);
    expect(bounded).toContain('[TRUNCATED 950 chars]');
  });

  it('bounds nested metadata objects', () => {
    const rawMeta = {
      short: 'hello',
      long: 'A'.repeat(500),
      nested: { a: 1 },
      arr: ['B'.repeat(300), { b: 2 }]
    };
    
    const result = boundMetadataObject(rawMeta);
    expect(result.short).toBe('hello');
    expect(result.long).toContain('[TRUNCATED 300 chars]');
    expect(result.nested).toBe('[Nested Object]');
    expect(result.arr[0]).toContain('[TRUNCATED 100 chars]');
    expect(result.arr[1]).toBe('[Nested Object]');
  });

  it('generates a deterministic structure with no signals', async () => {
    const data = {
      file: { name: 'test.jpg', type: 'image/jpeg', size: 1024 },
      arrayBuffer: new ArrayBuffer(1024),
      metadata: null,
      c2pa: null,
      forensics: null,
      cleaningRecord: null
    };

    const report = await generateForensicReport(data);

    expect(report._meta.title).toBe('Machine-readable forensic report');
    expect(report.caseInformation.caseId).toMatch(/^PT-\d{14}-[A-Z0-9]{4}$/);
    
    expect(report.imageIdentity.filename).toBe('test.jpg');
    expect(report.imageIdentity.sizeBytes).toBe(1024);
    
    // Check null safety
    expect(report.metadata).toBeNull();
    expect(report.c2paProvenance.manifestPresent).toBe(false);
    expect(report.forensicSignals.overallAssessment).toBe('INCONCLUSIVE');
    expect(report.cleaningRecord).toBeNull();
  });

  it('generates a complete report with all signals', async () => {
    const data = {
      file: { name: 'fake.png', type: 'image/png', size: 2048 },
      arrayBuffer: new ArrayBuffer(2048),
      dimensions: { width: 100, height: 100 },
      binaryStructure: {
        format: 'PNG',
        segments: [{ name: 'IHDR', offset: 0, length: 13, description: 'Header' }]
      },
      metadata: {
        software: 'Midjourney v6',
        exif: { Make: 'AI' }
      },
      c2pa: {
        provenance: 'SIGNED_AI_PROVENANCE',
        isSigned: true,
        issuer: 'OpenAI',
        generator: 'DALL-E 3',
        actions: [{ action: 'c2pa.created' }]
      },
      forensics: {
        overallAssessment: 'VERIFIED_SIGNED_AI_PROVENANCE',
        humanReasoning: 'Signed AI provenance found.',
        ela: { maxDifference: 150 },
        modelResult: { syntheticLikelihood: 0.99, signalStrength: 'HIGH', modelVersion: 'v1' }
      },
      cleaningRecord: {
        cleanedBuffer: new ArrayBuffer(1000),
        removed: ['EXIF'],
        pixelsReencoded: false,
        c2paPreserved: true
      }
    };

    const report = await generateForensicReport(data);

    expect(report.imageIdentity.dimensions).toBe('100x100');
    expect(report.imageIdentity.pixelCount).toBe(10000);
    expect(report.binaryStructure.format).toBe('PNG');
    expect(report.metadata.software).toBe('Midjourney v6');
    
    expect(report.c2paProvenance.manifestPresent).toBe(true);
    expect(report.c2paProvenance.signer).toBe('OpenAI');
    expect(report.c2paProvenance.actions.length).toBe(1);
    
    expect(report.forensicSignals.overallAssessment).toBe('VERIFIED_SIGNED_AI_PROVENANCE');
    expect(report.forensicSignals.compressionDifferenceEla.maxDifference).toBe(150);
    expect(report.forensicSignals.localAiModelResult.score).toBe(0.99);

    expect(report.cleaningRecord.cleanedSize).toBe(1000);
    expect(report.cleaningRecord.encodedImageDataChanged).toBe(false);
  });
});
