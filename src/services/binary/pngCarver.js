import { createResult } from './policy.js';

const PNG_SIGNATURE = [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A];

function checkSignature(bytes) {
  if (bytes.length < 8) return false;
  for (let i = 0; i < 8; i++) {
    if (bytes[i] !== PNG_SIGNATURE[i]) return false;
  }
  return true;
}

const textDecoder = new TextDecoder('ascii');

/**
 * Parses and selectively copies PNG chunks.
 */
export function sanitizePng(inputBytes, policy) {
  const result = {
    format: 'png',
    inputBytes,
    outputBytes: null,
    removedSegments: [],
    preservedSegments: [],
    imageBitstreamChanged: false,
    c2paPreserved: false,
    warnings: [],
    status: 'success'
  };

  const len = inputBytes.length;
  if (!checkSignature(inputBytes)) {
    result.status = 'malformed';
    result.error = 'Not a valid PNG (missing signature).';
    return createResult(result);
  }

  const outputChunks = [];
  outputChunks.push(inputBytes.subarray(0, 8)); // Signature

  let offset = 8;
  let iendReached = false;
  let segmentCount = 0;
  const MAX_SEGMENTS = 5000;

  while (offset < len) {
    if (segmentCount++ > MAX_SEGMENTS) {
      result.status = 'malformed';
      result.error = 'Exceeded maximum number of chunks (possible DOS).';
      return createResult(result);
    }

    if (offset + 8 > len) {
      result.status = 'malformed';
      result.error = 'Truncated chunk header.';
      return createResult(result);
    }

    const chunkLen = (inputBytes[offset] << 24) |
                     (inputBytes[offset + 1] << 16) |
                     (inputBytes[offset + 2] << 8) |
                     (inputBytes[offset + 3]);
                     
    if (chunkLen < 0) {
      result.status = 'malformed';
      result.error = 'Invalid chunk length (too large).';
      return createResult(result);
    }

    const chunkTypeBytes = inputBytes.subarray(offset + 4, offset + 8);
    const chunkType = textDecoder.decode(chunkTypeBytes);

    const nextOffset = offset + 8 + chunkLen + 4; // length + type + data + crc

    if (nextOffset > len) {
       result.status = 'malformed';
       result.error = `Chunk ${chunkType} exceeds file length.`;
       return createResult(result);
    }

    const chunkData = inputBytes.subarray(offset + 8, offset + 8 + chunkLen);
    
    // Critical chunks have the first letter capitalized.
    // e.g., IHDR, PLTE, IDAT, IEND. We NEVER remove these.
    const isCritical = (chunkTypeBytes[0] & 32) === 0;

    let keep = true;
    let typeDesc = `Chunk_${chunkType}`;

    if (isCritical) {
      keep = true;
      if (chunkType === 'IEND') iendReached = true;
    } else {
      // Ancillary chunk. We can remove it based on policy.
      
      // EXIF
      if (chunkType === 'eXIf' && policy.removeExif) {
        keep = false;
      }
      
      // Text chunks (tEXt, zTXt, iTXt) can contain XMP, comments, C2PA, etc.
      if (chunkType === 'tEXt' || chunkType === 'zTXt' || chunkType === 'iTXt') {
        // Need to parse keyword which is null terminated.
        let nullIdx = -1;
        for (let i = 0; i < Math.min(chunkLen, 80); i++) {
          if (chunkData[i] === 0) {
            nullIdx = i;
            break;
          }
        }
        
        let keyword = '';
        if (nullIdx !== -1) {
          keyword = textDecoder.decode(chunkData.subarray(0, nullIdx));
        }

        if (keyword === 'XML:com.adobe.xmp' && policy.removeXmp) {
          keep = false;
        } else if (keyword === 'Comment' || keyword === 'Description') {
          if (policy.removeComments) keep = false;
        } else if (keyword === 'c2pa' && policy.removeC2pa) {
          keep = false;
        } else if (keyword === 'c2pa' && policy.preserveC2pa) {
          keep = true;
          result.c2paPreserved = true;
        } else if (policy.removeExif) {
          // Some software blindly removes all text chunks to be safe, but we only remove known metadata.
          // In strict modes, we could remove everything, but here we just target common ones unless told otherwise.
          // Let's remove all text chunks if we want to remove ALL comments and metadata, except if it's C2PA we want to preserve.
          if (policy.removeComments && policy.removeXmp) {
              // We'll cautiously keep it unless it matches, or we can just nuke it.
              // Let's be aggressive for privacy if removeComments is true.
              if (!(keyword === 'c2pa' && policy.preserveC2pa)) {
                 keep = false;
              }
          }
        }
      }
      
      // JUMBF/C2PA (sometimes in caBX)
      if (chunkType === 'caBX') {
        if (policy.removeC2pa) keep = false;
        if (policy.preserveC2pa) {
            keep = true;
            result.c2paPreserved = true;
        }
      }
      
      // ICC Profile (iCCP)
      if (chunkType === 'iCCP' && policy.removeIcc) {
        keep = false;
      }
      
      // Physical pixel dimensions (pHYs), often kept, but sometimes considered metadata.
      // We will keep it unless an extremely strict policy is applied.
    }

    if (keep) {
      outputChunks.push(inputBytes.subarray(offset, nextOffset));
      result.preservedSegments.push({ type: typeDesc, offset, size: nextOffset - offset });
    } else {
      result.removedSegments.push({ type: typeDesc, offset, size: nextOffset - offset });
    }

    offset = nextOffset;
    if (iendReached) break;
  }
  
  if (!iendReached) {
      // Allow it, some PNGs have trailing garbage, but we processed up to EOF.
      result.warnings.push('IEND chunk not found before end of file.');
  }
  
  // Calculate total length
  let totalLength = 0;
  for (const chunk of outputChunks) {
    totalLength += chunk.length;
  }

  const outputBytes = new Uint8Array(totalLength);
  let writeOffset = 0;
  for (const chunk of outputChunks) {
    outputBytes.set(chunk, writeOffset);
    writeOffset += chunk.length;
  }

  result.outputBytes = outputBytes;
  return createResult(result);
}
