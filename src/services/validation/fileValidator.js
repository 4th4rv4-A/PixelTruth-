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
 * Does not rely on file extension or MIME type. Note: This validates header safety only, not full container integrity.
 * @param {File} file
 * @returns {Promise<Object>} structured validation result
 */
export async function validateHeaderSafety(file) {
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
  } else if (
    bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46 &&
    bytes[3] === 0x38 && (bytes[4] === 0x37 || bytes[4] === 0x39) && bytes[5] === 0x61
  ) {
    result.format = 'gif';
    result.mime = 'image/gif';
    parseGif(bytes, result);
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
        let ftypLen = ((bytes[0] << 24) | (bytes[1] << 16) | (bytes[2] << 8) | bytes[3]) >>> 0;
        let brandOffset = 8;
        if (ftypLen === 1 && bytes.length >= 16) {
          const high = ((bytes[8] << 24) | (bytes[9] << 16) | (bytes[10] << 8) | bytes[11]) >>> 0;
          const low = ((bytes[12] << 24) | (bytes[13] << 16) | (bytes[14] << 8) | bytes[15]) >>> 0;
          ftypLen = high * 0x100000000 + low;
          brandOffset = 16;
        }

        const majorBrand = textDecoder.decode(bytes.subarray(brandOffset, brandOffset + 4));
        let isAvif = majorBrand === 'avif' || majorBrand === 'avis';
        if (!isAvif && ftypLen > brandOffset + 8) {
          for (let b = brandOffset + 8; b + 4 <= Math.min(bytes.length, ftypLen); b += 4) {
            const brand = textDecoder.decode(bytes.subarray(b, b + 4));
            if (brand === 'avif' || brand === 'avis') {
              isAvif = true;
              break;
            }
          }
        }

        if (isAvif) {
          result.format = 'avif';
          result.mime = 'image/avif';
        } else {
          result.format = 'heic';
          result.mime = 'image/heic';
        }
        parseBmff(bytes, result);
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
    const chunkLen = ((bytes[offset + 4]) | (bytes[offset + 5] << 8) | (bytes[offset + 6] << 16) | (bytes[offset + 7] << 24)) >>> 0;
    
    const paddedLen = chunkLen % 2 !== 0 ? chunkLen + 1 : chunkLen;

    if (chunkType === 'VP8X') {
      if (offset + 18 <= bytes.length) {
        // 24-bit canvas width minus one
        const w = bytes[offset + 12] | (bytes[offset + 13] << 8) | (bytes[offset + 14] << 16);
        // 24-bit canvas height minus one
        const h = bytes[offset + 15] | (bytes[offset + 16] << 8) | (bytes[offset + 17] << 16);
        result.width = w + 1;
        result.height = h + 1;
        return; // VP8X defines canvas size, done.
      } else {
        result.reasons.push('MALFORMED_CONTAINER');
        return;
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
 * Parses GIF Logical Screen Descriptor to extract dimensions (bytes 6-9, little-endian).
 */
function parseGif(bytes, result) {
  if (bytes.length < 10) {
    result.reasons.push('DIMENSIONS_UNKNOWN');
    return;
  }
  // Logical Screen Descriptor width and height (16-bit unsigned little-endian)
  result.width = bytes[6] | (bytes[7] << 8);
  result.height = bytes[8] | (bytes[9] << 8);

  if (result.width <= 0 || result.height <= 0) {
    result.reasons.push('DIMENSIONS_UNKNOWN');
  }
}

/**
 * Parses HEIC/AVIF/BMFF container to find the 'ispe' box for dimensions.
 */
function parseBmff(bytes, result) {
  let offset = 0;
  
  // Basic BMFF box traversal
  while (offset < bytes.length) {
    if (offset + 8 > bytes.length) break;
    
    const rawSize = ((bytes[offset] << 24) | (bytes[offset + 1] << 16) | (bytes[offset + 2] << 8) | bytes[offset + 3]) >>> 0;
    const type = textDecoder.decode(bytes.subarray(offset + 4, offset + 8));

    let size = rawSize;
    let headerSize = 8;

    if (rawSize === 1) { // 64-bit size
      if (offset + 16 > bytes.length) {
        result.reasons.push('MALFORMED_CONTAINER');
        break;
      }
      const high = ((bytes[offset + 8] << 24) | (bytes[offset + 9] << 16) | (bytes[offset + 10] << 8) | bytes[offset + 11]) >>> 0;
      const low = ((bytes[offset + 12] << 24) | (bytes[offset + 13] << 16) | (bytes[offset + 14] << 8) | bytes[offset + 15]) >>> 0;
      if (high > 0x1FFFFF) {
        result.reasons.push('MALFORMED_CONTAINER');
        break;
      }
      size = high * 0x100000000 + low;
      headerSize = 16;
    } else if (rawSize === 0) {
      size = bytes.length - offset;
    }

    if (size < headerSize) {
      result.reasons.push('MALFORMED_CONTAINER');
      break; 
    }

    if (type === 'meta' || type === 'iprp' || type === 'ipco') {
      // Container boxes, dive into them
      offset += headerSize;
      if (type === 'meta') {
        // meta has 4 byte version/flags
        offset += 4; 
      }
      continue;
    }

    if (type === 'ispe') {
      // ispe has 4 byte version/flags, then 4 byte width, 4 byte height
      const ispeDataOffset = offset + headerSize;
      if (ispeDataOffset + 12 <= bytes.length) {
        result.width = ((bytes[ispeDataOffset + 4] << 24) | (bytes[ispeDataOffset + 5] << 16) | (bytes[ispeDataOffset + 6] << 8) | bytes[ispeDataOffset + 7]) >>> 0;
        result.height = ((bytes[ispeDataOffset + 8] << 24) | (bytes[ispeDataOffset + 9] << 16) | (bytes[ispeDataOffset + 10] << 8) | bytes[ispeDataOffset + 11]) >>> 0;
        return; // found it
      }
    }

    // Skip box
    offset += size;
  }

  if (result.width === 0) {
    result.reasons.push('DIMENSIONS_UNKNOWN');
  }
}

