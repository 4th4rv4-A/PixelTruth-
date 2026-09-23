/**
 * Calculates SHA-256 (and SHA-512) for an ArrayBuffer.
 * @param {ArrayBuffer} buffer
 * @returns {Promise<{sha256: string, sha512: string|null}>}
 */
export async function computeHashes(buffer) {
  try {
    const sha256Buffer = await crypto.subtle.digest('SHA-256', buffer);
    const sha256 = Array.from(new Uint8Array(sha256Buffer))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
      
    let sha512 = null;
    try {
      const sha512Buffer = await crypto.subtle.digest('SHA-512', buffer);
      sha512 = Array.from(new Uint8Array(sha512Buffer))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');
    } catch {
      // SHA-512 might not be supported in some environments
    }

    return { sha256, sha512 };
  } catch (error) {
    console.error('Hashing failed:', error);
    return { sha256: 'UNAVAILABLE', sha512: null };
  }
}

/**
 * Truncates long strings to prevent memory exhaustion in the report.
 * @param {any} value 
 * @param {number} maxLen 
 * @returns {string}
 */
export function boundValue(value, maxLen = 500) {
  if (value === null || value === undefined) return null;
  const str = String(value);
  if (str.length > maxLen) {
    return str.substring(0, maxLen) + `... [TRUNCATED ${str.length - maxLen} chars]`;
  }
  return str;
}

/**
 * Bounds deeply nested metadata objects.
 */
export function boundMetadataObject(obj) {
  if (!obj) return null;
  const bounded = {};
  for (const [key, value] of Object.entries(obj)) {
    if (typeof value === 'object' && value !== null) {
      if (Array.isArray(value)) {
        bounded[key] = value.map(v => typeof v === 'object' ? '[Nested Object]' : boundValue(v, 200));
      } else {
        bounded[key] = '[Nested Object]';
      }
    } else {
      bounded[key] = boundValue(value, 200);
    }
  }
  return bounded;
}

/**
 * Generates the canonical JSON representation of the forensic report.
 * @param {Object} data 
 * @param {File} data.file
 * @param {ArrayBuffer} data.arrayBuffer
 * @param {Object} data.dimensions { width, height }
 * @param {Object} data.binaryStructure 
 * @param {Object} data.metadata
 * @param {Object} data.c2pa
 * @param {Object} data.forensics { ela, fft, modelResult }
 * @param {Object} data.cleaningRecord
 * @returns {Promise<Object>}
 */
export async function generateForensicReport(data) {
  const { file, arrayBuffer, dimensions, binaryStructure, metadata, c2pa, forensics, cleaningRecord } = data;
  
  const timestamp = new Date().toISOString();
  const caseId = `PT-${timestamp.replace(/\D/g, '').substring(0, 14)}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;

  const hashes = arrayBuffer ? await computeHashes(arrayBuffer) : { sha256: null, sha512: null };
  
  let cleanedHashes = null;
  if (cleaningRecord?.cleanedBuffer) {
    cleanedHashes = await computeHashes(cleaningRecord.cleanedBuffer);
  }

  const report = {
    _meta: {
      title: 'Machine-readable forensic report',
      description: 'Deterministic JSON aggregation of diagnostic signals. This file is NOT cryptographically signed.',
    },
    caseInformation: {
      generatedTimestamp: timestamp,
      pixelTruthVersion: '2.0.0',
      reportVersion: '1.0',
      caseId
    },
    imageIdentity: {
      filename: file?.name || 'unknown',
      mime: file?.type || 'application/octet-stream',
      sizeBytes: file?.size || 0,
      dimensions: dimensions ? `${dimensions.width}x${dimensions.height}` : 'unknown',
      pixelCount: dimensions ? dimensions.width * dimensions.height : 0,
      sha256: hashes.sha256,
      sha512: hashes.sha512
    },
    binaryStructure: binaryStructure ? {
      format: binaryStructure.format,
      segments: (binaryStructure.segments || []).map(seg => ({
        name: seg.name,
        offset: seg.offset,
        length: seg.length,
        description: boundValue(seg.description, 100)
      }))
    } : null,
    metadata: metadata ? {
      software: boundValue(metadata.software || metadata.Make || metadata.Model),
      timestamps: metadata.DateTimeOriginal || metadata.CreateDate,
      comments: boundValue(metadata.UserComment),
      // Bound the raw blocks
      exif: boundMetadataObject(metadata.exif),
      xmp: boundMetadataObject(metadata.xmp),
      iptc: boundMetadataObject(metadata.iptc),
      icc: boundMetadataObject(metadata.icc)
    } : null,
    c2paProvenance: c2pa ? {
      manifestPresent: c2pa.provenance !== 'NO_PROVENANCE',
      validationStatus: c2pa.validationNote || 'Valid',
      signatureStatus: c2pa.isSigned ? 'Valid' : 'Missing/Invalid',
      signer: c2pa.issuer || 'Unknown',
      sourceType: c2pa.generator || 'Unknown',
      trustResult: c2pa.provenance,
      actions: c2pa.actions || [],
      assertions: c2pa.assertions || [],
      warnings: c2pa.validationIssues || []
    } : { manifestPresent: false },
    forensicSignals: {
      overallAssessment: forensics?.overallAssessment || 'INCONCLUSIVE',
      humanReasoning: forensics?.humanReasoning || 'No analysis performed.',
      compressionDifferenceEla: forensics?.ela ? {
        maxDifference: forensics.ela.maxDifference
      } : null,
      frequencyDiagnosticsFft: forensics?.fft ? {
        maxMagnitude: forensics.fft.maxMagnitude
      } : null,
      localAiModelResult: forensics?.modelResult ? {
        score: forensics.modelResult.syntheticLikelihood,
        signalStrength: forensics.modelResult.signalStrength,
        model: forensics.modelResult.modelVersion
      } : null,
      metadataIndicators: forensics?.metadataSignals || []
    },
    cleaningRecord: cleaningRecord ? {
      originalSha256: hashes.sha256,
      cleanedSha256: cleanedHashes?.sha256,
      originalSize: file?.size,
      cleanedSize: cleaningRecord.cleanedBuffer?.byteLength,
      removedStructures: cleaningRecord.removed || [],
      preservedStructures: cleaningRecord.preserved || [],
      encodedImageDataChanged: cleaningRecord.pixelsReencoded === true,
      c2paPreserved: cleaningRecord.c2paPreserved === true
    } : null,
    limitations: forensics?.limitations || [
      'Visual forensics (ELA/FFT) highlight structural anomalies, not definitive proof of manipulation.',
      'AI models are heuristic and subject to adversarial noise or unseen generators.',
      'True origin verification requires cryptographic Content Credentials (C2PA).'
    ]
  };

  return report;
}
