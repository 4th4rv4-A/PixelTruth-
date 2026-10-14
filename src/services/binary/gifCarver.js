import { createResult } from './policy.js';

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder('ascii');

const NETSCAPE_APP_ID = textEncoder.encode("NETSCAPE2.0");
const ANIMEXTS_APP_ID = textEncoder.encode("ANIMEXTS1.0");

function bufferStartsWith(buffer, offset, signature) {
  if (offset + signature.length > buffer.length) return false;
  for (let i = 0; i < signature.length; i++) {
    if (buffer[offset + i] !== signature[i]) return false;
  }
  return true;
}

/**
 * Losslessly sanitizes a GIF file (GIF87a or GIF89a).
 * Strips Comment Extensions (0x21 0xFE) and XMP / metadata Application Extensions (0x21 0xFF),
 * while strictly preserving Graphic Control Extensions (0x21 0xF9, animation frame timing/transparency),
 * animation loop headers (NETSCAPE2.0), all local/global color tables, and exact image bitstreams.
 * Truncates any unreferenced trailing payload appended past the 0x3B trailer.
 *
 * @param {Uint8Array} inputBytes
 * @param {Object} [policy]
 * @returns {Object} result created by createResult
 */
export function sanitizeGif(inputBytes, policy = {}) {
  const len = inputBytes.length;
  if (len < 13) {
    return createResult({
      format: 'gif',
      inputBytes,
      status: 'malformed',
      error: 'File is too small to be a valid GIF image.'
    });
  }

  // 1. Verify GIF signature (GIF87a or GIF89a)
  const headerStr = textDecoder.decode(inputBytes.subarray(0, 6));
  if (headerStr !== 'GIF87a' && headerStr !== 'GIF89a') {
    return createResult({
      format: 'gif',
      inputBytes,
      status: 'malformed',
      error: 'Invalid GIF header signature.'
    });
  }

  // 2. Parse Logical Screen Descriptor
  let offset = 6;
  const packed = inputBytes[10];
  const hasGct = (packed & 0x80) !== 0;
  const gctSize = 3 * (1 << ((packed & 0x07) + 1));
  offset += 7; // Header + LSD = 13 bytes

  if (hasGct) {
    offset += gctSize;
  }

  if (offset > len) {
    return createResult({
      format: 'gif',
      inputBytes,
      status: 'malformed',
      error: 'Truncated Global Color Table.'
    });
  }

  const removedSegments = [];
  const preservedSegments = ['LSD'];
  if (hasGct) preservedSegments.push('GCT');

  // Slices of bytes to keep: [{ start, end }]
  const retainedSlices = [{ start: 0, end: offset }];
  let currentSliceStart = offset;

  let reachedTrailer = false;
  let trailerOffset = -1;

  while (offset < len) {
    const introducer = inputBytes[offset];

    // Trailer (0x3B) marks the end of a valid GIF stream
    if (introducer === 0x3B) {
      reachedTrailer = true;
      offset += 1;
      trailerOffset = offset;
      break;
    }

    // Extension block (0x21)
    if (introducer === 0x21) {
      if (offset + 2 > len) {
        break; // malformed truncation
      }
      const extLabel = inputBytes[offset + 1];
      const extStart = offset;
      offset += 2; // skip 0x21 and label

      if (extLabel === 0xF9) {
        // Graphic Control Extension (delay time, transparency, disposal)
        // Fixed length block: blockSize (4), data (4), terminator (0) = 6 bytes after label
        if (offset < len) {
          const blockSize = inputBytes[offset];
          offset += 1 + blockSize + 1; // blockSize + payload + terminator 0x00
        }
        preservedSegments.push('GRAPHIC_CONTROL');
        continue;
      }

      if (extLabel === 0xFE) {
        // Comment Extension -> ALWAYS STRIP
        // Cut current slice right before extStart
        if (extStart > currentSliceStart) {
          retainedSlices.push({ start: currentSliceStart, end: extStart });
        }

        // Skip sub-blocks
        while (offset < len) {
          const subLen = inputBytes[offset];
          offset += 1;
          if (subLen === 0) break;
          offset += subLen;
        }

        currentSliceStart = offset;
        removedSegments.push('COMMENT_EXTENSION');
        continue;
      }

      if (extLabel === 0xFF) {
        // Application Extension
        // Can be NETSCAPE2.0 (animation loop count) or XMP Data / metadata
        let isNetscape = false;
        if (offset < len) {
          const blockSize = inputBytes[offset];
          if (blockSize === 11 && offset + 1 + 11 <= len) {
            const appId = inputBytes.subarray(offset + 1, offset + 1 + 11);
            if (bufferStartsWith(appId, 0, NETSCAPE_APP_ID) || bufferStartsWith(appId, 0, ANIMEXTS_APP_ID)) {
              isNetscape = true;
            }
          }
        }

        if (isNetscape) {
          // Preserve animation loop header!
          // Skip sub-blocks
          while (offset < len) {
            const subLen = inputBytes[offset];
            offset += 1;
            if (subLen === 0) break;
            offset += subLen;
          }
          preservedSegments.push('ANIMATION_EXTENSION');
          continue;
        } else {
          // Strip application metadata (e.g. XMP Data)
          if (extStart > currentSliceStart) {
            retainedSlices.push({ start: currentSliceStart, end: extStart });
          }

          while (offset < len) {
            const subLen = inputBytes[offset];
            offset += 1;
            if (subLen === 0) break;
            offset += subLen;
          }

          currentSliceStart = offset;
          removedSegments.push('APPLICATION_EXTENSION');
          continue;
        }
      }

      if (extLabel === 0x01) {
        // Plain Text Extension (metadata text)
        if (policy.removeComments !== false) {
          if (extStart > currentSliceStart) {
            retainedSlices.push({ start: currentSliceStart, end: extStart });
          }

          while (offset < len) {
            const subLen = inputBytes[offset];
            offset += 1;
            if (subLen === 0) break;
            offset += subLen;
          }

          currentSliceStart = offset;
          removedSegments.push('PLAIN_TEXT_EXTENSION');
          continue;
        }
      }

      // Generic extension fallback: read sub-blocks
      while (offset < len) {
        const subLen = inputBytes[offset];
        offset += 1;
        if (subLen === 0) break;
        offset += subLen;
      }
      continue;
    }

    // Image Descriptor (0x2C)
    if (introducer === 0x2C) {
      if (offset + 10 > len) {
        break; // malformed
      }

      const imgPacked = inputBytes[offset + 9];
      const hasLct = (imgPacked & 0x80) !== 0;
      offset += 10;

      if (hasLct) {
        const lctSize = 3 * (1 << ((imgPacked & 0x07) + 1));
        offset += lctSize;
      }

      // LZW minimum code size (1 byte)
      if (offset < len) {
        offset += 1;
      }

      // Image data sub-blocks
      while (offset < len) {
        const subLen = inputBytes[offset];
        offset += 1;
        if (subLen === 0) break;
        offset += subLen;
      }

      preservedSegments.push('IMAGE_DESCRIPTOR');
      continue;
    }

    // Unknown byte, advance
    offset++;
  }

  // Include final retained slice up to trailer or offset
  const finalBoundary = reachedTrailer ? trailerOffset : offset;
  if (finalBoundary > currentSliceStart) {
    retainedSlices.push({ start: currentSliceStart, end: finalBoundary });
  }

  // Check if there was trailing payload past trailer 0x3B
  if (reachedTrailer && len > trailerOffset) {
    removedSegments.push('TRAILING_PAYLOAD');
  }

  // Calculate total retained length
  let totalRetained = 0;
  for (const s of retainedSlices) {
    totalRetained += (s.end - s.start);
  }

  // If no trailer was found in the input, append trailer 0x3B if valid image data exists
  const needsTrailerAppend = !reachedTrailer;
  const finalSize = totalRetained + (needsTrailerAppend ? 1 : 0);

  const outputBytes = new Uint8Array(finalSize);
  let writeOffset = 0;
  for (const s of retainedSlices) {
    const chunk = inputBytes.subarray(s.start, s.end);
    outputBytes.set(chunk, writeOffset);
    writeOffset += chunk.length;
  }
  if (needsTrailerAppend) {
    outputBytes[writeOffset] = 0x3B;
  }

  return createResult({
    format: 'gif',
    inputBytes,
    outputBytes,
    removedSegments,
    preservedSegments,
    imageBitstreamChanged: false,
    status: 'success'
  });
}
