import { createResult } from './policy.js';

const textDecoder = new TextDecoder('ascii');

/**
 * Parses and selectively copies WebP RIFF chunks.
 */
export function sanitizeWebp(inputBytes, policy) {
  const result = {
    format: 'webp',
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
  if (len < 12) {
    result.status = 'malformed';
    result.error = 'File too small to be a valid WebP.';
    return createResult(result);
  }

  const riffSig = textDecoder.decode(inputBytes.subarray(0, 4));
  const webpSig = textDecoder.decode(inputBytes.subarray(8, 12));

  if (riffSig !== 'RIFF' || webpSig !== 'WEBP') {
    result.status = 'malformed';
    result.error = 'Not a valid WebP (missing RIFF/WEBP signature).';
    return createResult(result);
  }

  // File size declared in RIFF header
  const declaredSize = inputBytes[4] | (inputBytes[5] << 8) | (inputBytes[6] << 16) | (inputBytes[7] << 24);
  
  if (declaredSize + 8 > len && declaredSize > 0) {
     result.warnings.push('Declared RIFF size is larger than actual file size (truncated file).');
  }

  const outputChunks = [];
  // We will push the 12 byte header first, but we must UPDATE the size later.
  outputChunks.push(new Uint8Array(12)); 

  let offset = 12;
  let segmentCount = 0;
  const MAX_SEGMENTS = 5000;
  
  // Track flags for VP8X if we remove EXIF/XMP/ICCP
  let vp8xChunk = null;
  let vp8xOffset = -1;
  let newVp8xData = null;

  while (offset < len && offset < declaredSize + 8) {
    if (segmentCount++ > MAX_SEGMENTS) {
      result.status = 'malformed';
      result.error = 'Exceeded maximum number of chunks (possible DOS).';
      return createResult(result);
    }

    if (offset + 8 > len) {
       // EOF reached or truncated header
       break;
    }

    const chunkType = textDecoder.decode(inputBytes.subarray(offset, offset + 4));
    const chunkSize = inputBytes[offset + 4] | (inputBytes[offset + 5] << 8) | (inputBytes[offset + 6] << 16) | (inputBytes[offset + 7] << 24);
    
    if (chunkSize < 0) {
      result.status = 'malformed';
      result.error = 'Invalid chunk length (too large).';
      return createResult(result);
    }

    const paddedSize = chunkSize % 2 !== 0 ? chunkSize + 1 : chunkSize;
    const nextOffset = offset + 8 + paddedSize;

    if (nextOffset > len) {
       result.warnings.push(`Chunk ${chunkType} exceeds file length (truncated).`);
       // We'll copy what we have if it's an image chunk, or drop it.
       // For safety, we stop parsing.
       break;
    }

    let keep = true;
    let typeDesc = `Chunk_${chunkType}`;

    if (chunkType === 'EXIF' && policy.removeExif) {
      keep = false;
    } else if (chunkType === 'XMP ' && policy.removeXmp) {
      keep = false;
    } else if (chunkType === 'ICCP' && policy.removeIcc) {
      keep = false;
    }

    if (keep) {
      if (chunkType === 'VP8X') {
        // We might need to update the flags in VP8X if we removed EXIF/XMP/ICCP.
        vp8xChunk = inputBytes.subarray(offset, nextOffset);
        vp8xOffset = outputChunks.length;
        outputChunks.push(vp8xChunk); // Placeholder, will replace if needed
      } else {
        outputChunks.push(inputBytes.subarray(offset, nextOffset));
      }
      result.preservedSegments.push({ type: typeDesc, offset, size: nextOffset - offset });
    } else {
      result.removedSegments.push({ type: typeDesc, offset, size: nextOffset - offset });
    }

    offset = nextOffset;
  }
  
  // Update VP8X flags if necessary
  if (vp8xChunk) {
     // VP8X flags are at byte 8 (offset 0 in chunk data)
     // Bit 0: ICC profile
     // Bit 1: Alpha
     // Bit 2: EXIF metadata
     // Bit 3: XMP metadata
     // Bit 4: Animation
     const flags = vp8xChunk[8];
     let newFlags = flags;
     
     if (policy.removeIcc) newFlags &= ~0x20; // 0010 0000 -> wait, specification:
     /*
      Bit 0: Reserved (0)
      Bit 1: Reserved (0)
      Bit 2: ICC profile (1 = present)  -> mask 0x20 ? No, bits are typically read LSB to MSB in bytes, but let's check standard.
      Standard: 
      bit 0: ICC
      bit 1: Alpha
      bit 2: EXIF
      bit 3: XMP
      bit 4: Animation
      Actually it's:
      ICC profile (1 bit): 0x20
      Alpha (1 bit): 0x10
      EXIF (1 bit): 0x08
      XMP (1 bit): 0x04
      Animation (1 bit): 0x02
      So:
     */
     let modified = false;
     
     // To be perfectly safe, we'll parse the flags correctly based on RIFF WebP spec
     // ICC: bit 5 (0x20)
     // Alpha: bit 4 (0x10)
     // EXIF: bit 3 (0x08)
     // XMP: bit 2 (0x04)
     // Animation: bit 1 (0x02)
     
     if (policy.removeIcc && (newFlags & 0x20)) { newFlags &= ~0x20; modified = true; }
     if (policy.removeExif && (newFlags & 0x08)) { newFlags &= ~0x08; modified = true; }
     if (policy.removeXmp && (newFlags & 0x04)) { newFlags &= ~0x04; modified = true; }
     
     if (modified) {
         newVp8xData = new Uint8Array(vp8xChunk);
         newVp8xData[8] = newFlags;
         outputChunks[vp8xOffset] = newVp8xData;
     }
  }

  // Calculate total length
  let totalLength = 0;
  for (let i = 1; i < outputChunks.length; i++) {
    totalLength += outputChunks[i].length;
  }

  // Setup the header
  const header = outputChunks[0];
  header.set(inputBytes.subarray(0, 4), 0); // RIFF
  
  // RIFF size is total file size minus 8
  const riffSize = totalLength + 4; // 12 header - 8 + chunks
  header[4] = riffSize & 0xFF;
  header[5] = (riffSize >> 8) & 0xFF;
  header[6] = (riffSize >> 16) & 0xFF;
  header[7] = (riffSize >> 24) & 0xFF;
  
  header.set(inputBytes.subarray(8, 12), 8); // WEBP

  const outputBytes = new Uint8Array(totalLength + 12);
  let writeOffset = 0;
  for (const chunk of outputChunks) {
    outputBytes.set(chunk, writeOffset);
    writeOffset += chunk.length;
  }

  result.outputBytes = outputBytes;
  return createResult(result);
}
