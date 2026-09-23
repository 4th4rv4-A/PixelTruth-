const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB
const MAX_PIXELS = 64 * 1024 * 1024; // 64MP
const MAX_MEMORY_ESTIMATE = 500 * 1024 * 1024; // 500MB decoded limit
const MAX_METADATA_SIZE = 20 * 1024 * 1024; // 20MB limit for metadata blocks

const textDecoder = new TextDecoder('ascii');

function createResult(overrides) {
  return {
    valid: false,
    format: 'unknown',
    mime: 'application/octet-stream',
    sizeBytes: 0,
    width: 0,
    height: 0,
    pixelCount: 0,
    estimatedMemoryBytes: 0,
    reasons: [],
    warnings: [],
    ...overrides,
  };
}

/**
 * Validates a file strictly by reading its binary headers and checking limits.
 * Does not rely on file extension or MIME type.
 * @param {File} file
 * @returns {Promise<Object>} structured validation result
 */
export async function validateFile(file) {
  const result = createResult({ sizeBytes: file.size });

  // 1. Filename sanity
  // eslint-disable-next-line no-control-regex
  if (!file.name || file.name.length > 255 || /[\x00-\x1F]/.test(file.name)) {
    result.reasons.push('INVALID_FILENAME');
    return result;
  }

  // 2. File size limit
  if (file.size > MAX_FILE_SIZE) {
    result.reasons.push('FILE_TOO_LARGE');
    return result;
  }

  // Read up to first 1MB for header parsing (plenty for finding ispe or SOF)
  const bytesToRead = Math.min(file.size, 1024 * 1024);
  const arrayBuffer = await file.slice(0, bytesToRead).arrayBuffer();
  const bytes = new Uint8Array(arrayBuffer);

  // 3. Magic Number Check & Format Identification
  if (bytes.length < 16) {
    result.reasons.push('INVALID_SIGNATURE');
    return result;
  }

  if (bytes[0] === 0xFF && bytes[1] === 0xD8 && bytes[2] === 0xFF) {
    result.format = 'jpeg';
    result.mime = 'image/jpeg';
    parseJpeg(bytes, result);
  } else if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4E && bytes[3] === 0x47) {
    result.format = 'png';
    result.mime = 'image/png';
    parsePng(bytes, result);
  } else {
    const riff = textDecoder.decode(bytes.subarray(0, 4));
    const webp = textDecoder.decode(bytes.subarray(8, 12));
    if (riff === 'RIFF' && webp === 'WEBP') {
      result.format = 'webp';
      result.mime = 'image/webp';
      parseWebp(bytes, result);
    } else {
      const ftyp = textDecoder.decode(bytes.subarray(4, 8));
      if (ftyp === 'ftyp') {
        result.format = 'heic';
        // could be heic or heif depending on brand, we'll map to heic
        result.mime = 'image/heic'; 
        parseHeic(bytes, result);
      } else {
        result.reasons.push('UNSUPPORTED_FORMAT');
        return result;
      }
    }
  }

  // 4. Validate parsed results
  if (result.reasons.length > 0) {
    return result; // Already failed during parsing
  }

  if (result.width <= 0 || result.height <= 0) {
    result.reasons.push('DIMENSIONS_UNKNOWN');
    return result;
  }

  result.pixelCount = result.width * result.height;
  if (result.pixelCount > MAX_PIXELS) {
    result.reasons.push('PIXEL_LIMIT_EXCEEDED');
    return result;
  }

  // 5. Memory Estimation
  // A raw uncompressed 8-bit RGBA pixel takes 4 bytes.
  // Canvas decoding often consumes ~4 bytes per pixel.
  // We add a 1.5x overhead factor for browser internal structures and image copies.
  result.estimatedMemoryBytes = result.pixelCount * 4 * 1.5;
  if (result.estimatedMemoryBytes > MAX_MEMORY_ESTIMATE) {
    result.reasons.push('ESTIMATED_MEMORY_EXCEEDED');
    return result;
  }

  result.valid = true;
  return result;
}

/**
 * Parses JPEG to find SOF marker (width/height) and sums APP sizes.
 */
function parseJpeg(bytes, result) {
  let offset = 2; // skip SOI
  let metadataSize = 0;

  while (offset < bytes.length) {
    if (bytes[offset] !== 0xFF) {
      offset++;
      continue;
    }

    const marker = bytes[offset + 1];
    if (marker === 0xFF || marker === 0x00) {
      offset++;
      continue;
    }

    // Standalone markers
    if (marker === 0xD8 || marker === 0xD9 || (marker >= 0xD0 && marker <= 0xD7)) {
      offset += 2;
      if (marker === 0xD9) break; // EOI
      continue;
    }

    if (offset + 4 > bytes.length) {
      // Reached end of buffer without finding SOF
      result.reasons.push('DIMENSIONS_UNKNOWN');
      return;
    }

    const segLen = (bytes[offset + 2] << 8) | bytes[offset + 3];
    
    // Accumulate metadata size (APP chunks and COM)
    if ((marker >= 0xE0 && marker <= 0xEF) || marker === 0xFE) {
      metadataSize += segLen;
      if (metadataSize > MAX_METADATA_SIZE) {
        result.reasons.push('METADATA_TOO_LARGE');
        return;
      }
    }

    // Start of Frame markers containing dimensions
    // SOF0 (C0), SOF1 (C1), SOF2 (C2), SOF9 (C9), SOF10 (CA), SOF11 (CB)
    if (marker === 0xC0 || marker === 0xC1 || marker === 0xC2 || marker === 0xC9 || marker === 0xCA || marker === 0xCB) {
      if (offset + 9 <= bytes.length) {
        result.height = (bytes[offset + 5] << 8) | bytes[offset + 6];
        result.width = (bytes[offset + 7] << 8) | bytes[offset + 8];
        return; // found it
      }
    }

    // Stop parsing if we hit SOS (entropy data follows)
    if (marker === 0xDA) {
      break; 
    }

    offset += 2 + segLen;
  }

  if (result.width === 0) {
    result.reasons.push('DIMENSIONS_UNKNOWN');
  }
}

/**
 * Parses PNG to find IHDR chunk.
 */
function parsePng(bytes, result) {
  let offset = 8; // skip signature
  let metadataSize = 0;

  while (offset < bytes.length) {
    if (offset + 8 > bytes.length) break;

    const chunkLen = (bytes[offset] << 24) | (bytes[offset + 1] << 16) | (bytes[offset + 2] << 8) | bytes[offset + 3];
    if (chunkLen < 0) {
      result.reasons.push('MALFORMED_CONTAINER');
      return;
    }

    const chunkType = textDecoder.decode(bytes.subarray(offset + 4, offset + 8));
    
    if (chunkType === 'IHDR') {
      if (offset + 16 <= bytes.length) {
        result.width = (bytes[offset + 8] << 24) | (bytes[offset + 9] << 16) | (bytes[offset + 10] << 8) | bytes[offset + 11];
        result.height = (bytes[offset + 12] << 24) | (bytes[offset + 13] << 16) | (bytes[offset + 14] << 8) | bytes[offset + 15];
      }
    }

    // Text chunks are ancillary and start with lowercase
    if (chunkType === 'eXIf' || chunkType === 'tEXt' || chunkType === 'iTXt' || chunkType === 'zTXt') {
      metadataSize += chunkLen;
      if (metadataSize > MAX_METADATA_SIZE) {
        result.reasons.push('METADATA_TOO_LARGE');
        return;
      }
    }

    // We can stop once we have IHDR if we don't care about full metadata size scan, 
    // but a malicious PNG might put huge text chunks before IDAT.
    // However, we only loaded 1MB of the file! So if it's huge, it might be truncated.
    // That's fine, we are just looking for dimensions.
    if (chunkType === 'IDAT' && result.width > 0) {
      return; // Safe to stop once we hit image data and have dimensions
    }

    offset += 12 + chunkLen;
  }

  if (result.width === 0) {
    result.reasons.push('DIMENSIONS_UNKNOWN');
  }
}

/**
 * Parses WebP RIFF to find VP8X, VP8, or VP8L.
 */
function parseWebp(bytes, result) {
  let offset = 12; // skip RIFF...WEBP
  let metadataSize = 0;

  while (offset < bytes.length) {
    if (offset + 8 > bytes.length) break;

    const chunkType = textDecoder.decode(bytes.subarray(offset, offset + 4));
    const chunkLen = bytes[offset + 4] | (bytes[offset + 5] << 8) | (bytes[offset + 6] << 16) | (bytes[offset + 7] << 24);
    
    if (chunkLen < 0) {
      result.reasons.push('MALFORMED_CONTAINER');
      return;
    }

    const paddedLen = chunkLen % 2 !== 0 ? chunkLen + 1 : chunkLen;

    if (chunkType === 'VP8X') {
      if (offset + 14 <= bytes.length) {
        // 24-bit canvas width minus one
        const w = bytes[offset + 12] | (bytes[offset + 13] << 8) | (bytes[offset + 14] << 16);
        // 24-bit canvas height minus one
        const h = bytes[offset + 15] | (bytes[offset + 16] << 8) | (bytes[offset + 17] << 16);
        result.width = w + 1;
        result.height = h + 1;
        return; // VP8X defines canvas size, done.
      }
    } else if (chunkType === 'VP8 ') {
      // VP8 keyframe header is 10 bytes in. (offset+8 is chunk data)
      if (offset + 8 + 10 <= bytes.length) {
        const frameStart = bytes.subarray(offset + 8, offset + 8 + 10);
        // check signature
        if (frameStart[3] === 0x9D && frameStart[4] === 0x01 && frameStart[5] === 0x2A) {
          result.width = frameStart[6] | ((frameStart[7] & 0x3F) << 8);
          result.height = frameStart[8] | ((frameStart[9] & 0x3F) << 8);
          return;
        }
      }
    } else if (chunkType === 'VP8L') {
      if (offset + 8 + 5 <= bytes.length) {
        if (bytes[offset + 8] === 0x2F) { // Signature
          const b1 = bytes[offset + 9];
          const b2 = bytes[offset + 10];
          const b3 = bytes[offset + 11];
          const b4 = bytes[offset + 12];
          result.width = 1 + (((b2 & 0x3F) << 8) | b1);
          result.height = 1 + (((b4 & 0x0F) << 10) | (b3 << 2) | ((b2 & 0xC0) >> 6));
          return;
        }
      }
    }

    if (chunkType === 'EXIF' || chunkType === 'XMP ' || chunkType === 'ICCP') {
       metadataSize += chunkLen;
       if (metadataSize > MAX_METADATA_SIZE) {
         result.reasons.push('METADATA_TOO_LARGE');
         return;
       }
    }

    offset += 8 + paddedLen;
  }

  if (result.width === 0) {
    result.reasons.push('DIMENSIONS_UNKNOWN');
  }
}

/**
 * Parses HEIC/BMFF to find the 'ispe' box for dimensions.
 */
function parseHeic(bytes, result) {
  let offset = 0;
  
  // Basic BMFF box traversal
  while (offset < bytes.length) {
    if (offset + 8 > bytes.length) break;
    
    let size = (bytes[offset] << 24) | (bytes[offset + 1] << 16) | (bytes[offset + 2] << 8) | bytes[offset + 3];
    const type = textDecoder.decode(bytes.subarray(offset + 4, offset + 8));

    if (size === 1) { // 64-bit size
      if (offset + 16 > bytes.length) break;
      // We only care about reasonable file sizes (fit in 32 bits), so we just read the lower 32 bits
      // In JS, large bitwise ops need care, but we just want to avoid crashing on huge boxes.
      // If it's a huge box (mdat), we can just skip or stop parsing.
      // We're just looking for 'ispe', which is usually in 'meta' -> 'iprp' -> 'ipco'
      size = (bytes[offset + 12] << 24) | (bytes[offset + 13] << 16) | (bytes[offset + 14] << 8) | bytes[offset + 15];
      offset += 16;
    } else {
      offset += 8;
    }

    if (size === 0) {
      // Box extends to EOF
      break; 
    }

    let payloadSize = size - 8;
    if (size === 1) payloadSize = size - 16;

    if (type === 'meta' || type === 'iprp' || type === 'ipco') {
      // Container boxes, we dive into them
      if (type === 'meta') {
        // meta has 4 byte version/flags
        offset += 4; 
      }
      continue;
    }

    if (type === 'ispe') {
      // ispe has 4 byte version/flags, then 4 byte width, 4 byte height
      if (offset + 12 <= bytes.length) {
        result.width = (bytes[offset + 4] << 24) | (bytes[offset + 5] << 16) | (bytes[offset + 6] << 8) | bytes[offset + 7];
        result.height = (bytes[offset + 8] << 24) | (bytes[offset + 9] << 16) | (bytes[offset + 10] << 8) | bytes[offset + 11];
        return; // found it
      }
    }

    // Skip box
    offset += payloadSize;
  }

  if (result.width === 0) {
    result.reasons.push('DIMENSIONS_UNKNOWN');
  }
}
