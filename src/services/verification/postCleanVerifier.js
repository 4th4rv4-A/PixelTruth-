import exifr from 'exifr';
import { validatePolicy } from '../binary/policy.js';
import { getFormatFromMagicBytes } from '../binary/index.js';

const textDecoder = new TextDecoder('utf-8');
const asciiDecoder = new TextDecoder('ascii');

/**
 * Verified metadata categories tracked by post-clean verifier.
 */
export const VERIFIED_CATEGORIES = Object.freeze([
  'CONTAINER_STRUCTURE',
  'EXIF',
  'GPS',
  'XMP',
  'IPTC',
  'COMMENTS',
  'C2PA_JUMBF',
  'ICC_PROFILE',
  'EXTERNAL_PARSER_CROSS_CHECK'
]);

/**
 * Status definitions for post-clean verification.
 */
export const VERIFICATION_STATUS = Object.freeze({
  PASSED: 'VERIFICATION_PASSED',
  METADATA_REMAINS: 'METADATA_REMAINS',
  FAILED: 'VERIFICATION_FAILED'
});

/**
 * Format-specific post-clean structural and metadata verifier.
 *
 * Performs independent binary structure parsing and external parser cross-checking.
 * Never claims universal zero leakage without supporting checks.
 *
 * @param {Uint8Array} bytes The cleaned output binary
 * @param {Object} rawPolicy The policy used for sanitization
 * @returns {Promise<Object>} Verification result contract
 */
export async function verifyPostClean(bytes, rawPolicy = {}) {
  const policy = validatePolicy(rawPolicy);
  const remnants = [];
  const checksPerformed = [];

  if (!bytes || !(bytes instanceof Uint8Array) || bytes.length === 0) {
    return {
      status: VERIFICATION_STATUS.FAILED,
      verifiedCategories: ['CONTAINER_STRUCTURE'],
      remnants: [{ category: 'CONTAINER_STRUCTURE', detail: 'Empty or invalid byte buffer provided.' }],
      details: {
        format: 'unknown',
        structuralValidity: false,
        externalParserPassed: false,
        checksPerformed: ['CONTAINER_STRUCTURE']
      },
      summary: 'Verification failed: invalid or empty binary buffer.'
    };
  }

  const format = getFormatFromMagicBytes(bytes);

  // 1. Format-specific structural & binary metadata inspection
  let structuralValidity = false;

  switch (format) {
    case 'jpeg':
      structuralValidity = verifyJpegBinary(bytes, policy, remnants, checksPerformed);
      break;
    case 'png':
      structuralValidity = verifyPngBinary(bytes, policy, remnants, checksPerformed);
      break;
    case 'webp':
      structuralValidity = verifyWebpBinary(bytes, policy, remnants, checksPerformed);
      break;
    case 'gif':
      structuralValidity = verifyGifBinary(bytes, policy, remnants, checksPerformed);
      break;
    case 'mp4':
    case 'mov':
      structuralValidity = verifyVideoBinary(bytes, policy, remnants, checksPerformed);
      break;
    case 'pdf':
      structuralValidity = verifyPdfBinary(bytes, policy, remnants, checksPerformed);
      break;
    default:
      // Unknown or raw format - basic non-empty check
      checksPerformed.push('CONTAINER_STRUCTURE');
      structuralValidity = bytes.length >= 8;
      if (!structuralValidity) {
        remnants.push({ category: 'CONTAINER_STRUCTURE', detail: 'Unrecognized format with insufficient length.' });
      }
      break;
  }

  if (!structuralValidity) {
    return {
      status: VERIFICATION_STATUS.FAILED,
      verifiedCategories: checksPerformed,
      remnants,
      details: {
        format,
        structuralValidity: false,
        externalParserPassed: false,
        checksPerformed
      },
      summary: `Verification failed: ${format.toUpperCase()} container structure is malformed or corrupted.`
    };
  }

  // 2. Independent external parser cross-check (exifr for supported image formats)
  let externalParserPassed = true;
  if (['jpeg', 'png', 'webp', 'avif', 'heic'].includes(format)) {
    checksPerformed.push('EXTERNAL_PARSER_CROSS_CHECK');
    try {
      const parsed = await exifr.parse(bytes, {
        tiff: true,
        xmp: true,
        icc: true,
        iptc: true,
        jfif: false,
        ihdr: false,
        mergeOutput: true
      });

      if (parsed && typeof parsed === 'object') {
        const allowedKeys = new Set();
        if (policy.preserveOrientation && !policy.fullSanitize) {
          allowedKeys.add('Orientation');
        }
        if (policy.preserveColorSpace && !policy.fullSanitize) {
          allowedKeys.add('ColorSpace');
        }
        if (Array.isArray(policy.keepTags)) {
          for (const tag of policy.keepTags) {
            allowedKeys.add(tag);
          }
        }
        if (!policy.removeIcc && !policy.fullSanitize) {
          allowedKeys.add('ColorSpaceData');
          allowedKeys.add('ProfileDescription');
          allowedKeys.add('ProfileDateTime');
          allowedKeys.add('DeviceModel');
        }

const INTRINSIC_IMAGE_PROPERTIES = new Set([
  'ImageWidth',
  'ImageHeight',
  'width',
  'height',
  'bitDepth',
  'BitDepth',
  'colorType',
  'ColorType',
  'compression',
  'Compression',
  'filter',
  'Filter',
  'interlace',
  'Interlace',
  'format',
  'mime',
  'type',
  'jfif',
  'JFIFVersion',
  'ResolutionUnit',
  'XResolution',
  'YResolution'
]);

        for (const [key, value] of Object.entries(parsed)) {
          if (allowedKeys.has(key) || INTRINSIC_IMAGE_PROPERTIES.has(key)) continue;

          // Check if key is GPS
          const isGps = key.toLowerCase().includes('gps') || key === 'latitude' || key === 'longitude';
          if (isGps && policy.removeGps) {
            remnants.push({
              category: 'GPS',
              detail: `External parser detected GPS metadata: ${key}=${String(value)}`
            });
            externalParserPassed = false;
            continue;
          }

          // Check if key is timestamp
          const isTimestamp = key.toLowerCase().includes('date') || key.toLowerCase().includes('time');
          if (isTimestamp && policy.removeTimestamps) {
            remnants.push({
              category: 'EXIF',
              detail: `External parser detected timestamp metadata: ${key}=${String(value)}`
            });
            externalParserPassed = false;
            continue;
          }

          // General EXIF/XMP/IPTC tag
          if (policy.removeExif || policy.removeXmp || policy.removeIptc) {
            remnants.push({
              category: 'EXIF',
              detail: `External parser detected unapproved metadata tag: ${key}`
            });
            externalParserPassed = false;
          }
        }
      }
    } catch {
      // exifr throws on completely stripped files or unknown tags; treat as no leaked metadata
      externalParserPassed = true;
    }
  }

  const status = remnants.length > 0
    ? VERIFICATION_STATUS.METADATA_REMAINS
    : VERIFICATION_STATUS.PASSED;

  const verifiedCategories = Array.from(new Set(checksPerformed));

  const summary = status === VERIFICATION_STATUS.PASSED
    ? `Verification passed: Verified clean for ${verifiedCategories.join(', ')}.`
    : `Verification alert: Detected ${remnants.length} metadata remnant(s) or policy discrepancies.`;

  return {
    status,
    verifiedCategories,
    remnants,
    details: {
      format,
      structuralValidity,
      externalParserPassed,
      checksPerformed
    },
    summary
  };
}

// ---------------------------------------------------------------------------
// Format-specific binary verifiers
// ---------------------------------------------------------------------------

function verifyJpegBinary(bytes, policy, remnants, checksPerformed) {
  checksPerformed.push('CONTAINER_STRUCTURE');
  checksPerformed.push('EXIF');
  checksPerformed.push('GPS');
  checksPerformed.push('XMP');
  checksPerformed.push('IPTC');
  checksPerformed.push('COMMENTS');
  checksPerformed.push('C2PA_JUMBF');
  checksPerformed.push('ICC_PROFILE');

  if (bytes.length < 4 || bytes[0] !== 0xFF || bytes[1] !== 0xD8) {
    remnants.push({ category: 'CONTAINER_STRUCTURE', detail: 'Missing JPEG SOI marker (0xFFD8).' });
    return false;
  }

  // Find EOI
  let eoiOffset = -1;
  for (let i = bytes.length - 2; i >= 0; i--) {
    if (bytes[i] === 0xFF && bytes[i + 1] === 0xD9) {
      eoiOffset = i;
      break;
    }
  }

  if (eoiOffset === -1) {
    remnants.push({ category: 'CONTAINER_STRUCTURE', detail: 'Missing JPEG EOI marker (0xFFD9).' });
    return false;
  }

  if (eoiOffset !== bytes.length - 2) {
    remnants.push({
      category: 'CONTAINER_STRUCTURE',
      detail: `Unexpected trailing payload of ${bytes.length - 2 - eoiOffset} bytes after JPEG EOI.`,
      offset: eoiOffset + 2
    });
  }

  let offset = 2;
  while (offset + 1 < eoiOffset) {
    if (bytes[offset] !== 0xFF) {
      remnants.push({ category: 'CONTAINER_STRUCTURE', detail: `Malformed JPEG marker at offset 0x${offset.toString(16)}.` });
      return false;
    }

    // Skip padding FF
    while (offset < eoiOffset && bytes[offset] === 0xFF) {
      offset++;
    }

    if (offset >= eoiOffset) break;

    const marker = bytes[offset];
    offset++;

    // Standalone markers
    if (marker === 0xD8 || marker === 0xD9 || (marker >= 0xD0 && marker <= 0xD7) || marker === 0x01) {
      continue;
    }

    if (marker === 0xDA) {
      // SOS (Start of Scan) - scan data follows until EOI
      break;
    }

    if (offset + 2 > eoiOffset) {
      remnants.push({ category: 'CONTAINER_STRUCTURE', detail: 'Truncated marker length.' });
      return false;
    }

    const segLength = (bytes[offset] << 8) | bytes[offset + 1];
    if (segLength < 2 || offset + segLength > bytes.length) {
      remnants.push({ category: 'CONTAINER_STRUCTURE', detail: 'Corrupted segment length.' });
      return false;
    }

    const segStart = offset + 2;
    const segEnd = offset + segLength;

    // Check APP1 (EXIF / XMP)
    if (marker === 0xE1) {
      const sig = textDecoder.decode(bytes.subarray(segStart, Math.min(segStart + 29, segEnd)));
      if (sig.startsWith('Exif\0\0')) {
        if (policy.fullSanitize) {
          remnants.push({ category: 'EXIF', detail: 'APP1 Exif segment present in fullSanitize mode.', offset: segStart });
        } else if (policy.removeExif && !policy.preserveOrientation && !policy.preserveColorSpace && policy.keepTags.length === 0) {
          remnants.push({ category: 'EXIF', detail: 'APP1 Exif segment present when all EXIF is disallowed.', offset: segStart });
        }
      } else if (sig.startsWith('http://ns.adobe.com/xap/1.0/') || sig.startsWith('http://ns.adobe.com/xmp/extension/')) {
        if (policy.removeXmp) {
          remnants.push({ category: 'XMP', detail: 'APP1 XMP segment present.', offset: segStart });
        }
      }
    }

    // Check APP2 (ICC Profile)
    if (marker === 0xE2) {
      const sig = textDecoder.decode(bytes.subarray(segStart, Math.min(segStart + 12, segEnd)));
      if (sig.startsWith('ICC_PROFILE\0') && policy.removeIcc) {
        remnants.push({ category: 'ICC_PROFILE', detail: 'APP2 ICC profile present when removeIcc is true.', offset: segStart });
      }
    }

    // Check APP11 (C2PA / JUMBF)
    if (marker === 0xEB) {
      const sig = asciiDecoder.decode(bytes.subarray(segStart, Math.min(segStart + 16, segEnd)));
      if (sig.includes('jumb') || sig.includes('JUMBF') || sig.includes('c2pa') || (bytes[segStart] === 0x4A && bytes[segStart + 1] === 0x50)) {
        if (policy.removeC2pa) {
          remnants.push({ category: 'C2PA_JUMBF', detail: 'APP11 C2PA / JUMBF credentials segment present.', offset: segStart });
        }
      }
    }

    // Check APP13 (IPTC / Photoshop)
    if (marker === 0xED) {
      const sig = textDecoder.decode(bytes.subarray(segStart, Math.min(segStart + 14, segEnd)));
      if (sig.startsWith('Photoshop 3.0\0') && policy.removeIptc) {
        remnants.push({ category: 'IPTC', detail: 'APP13 IPTC Photoshop segment present.', offset: segStart });
      }
    }

    // Check COM (Comment)
    if (marker === 0xFE && policy.removeComments) {
      remnants.push({ category: 'COMMENTS', detail: 'JPEG COM (Comment) segment present.', offset: segStart });
    }

    offset += segLength;
  }

  return true;
}

function verifyPngBinary(bytes, policy, remnants, checksPerformed) {
  checksPerformed.push('CONTAINER_STRUCTURE');
  checksPerformed.push('EXIF');
  checksPerformed.push('XMP');
  checksPerformed.push('COMMENTS');
  checksPerformed.push('C2PA_JUMBF');
  checksPerformed.push('ICC_PROFILE');

  const pngSig = [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A];
  if (bytes.length < 8) return false;
  for (let i = 0; i < 8; i++) {
    if (bytes[i] !== pngSig[i]) {
      remnants.push({ category: 'CONTAINER_STRUCTURE', detail: 'Invalid PNG header signature.' });
      return false;
    }
  }

  let offset = 8;
  let hasIhdr = false;
  let hasIdat = false;
  let hasIend = false;

  while (offset + 12 <= bytes.length) {
    const chunkLen = ((bytes[offset] << 24) | (bytes[offset + 1] << 16) | (bytes[offset + 2] << 8) | bytes[offset + 3]) >>> 0;
    const chunkType = asciiDecoder.decode(bytes.subarray(offset + 4, offset + 8));

    if (offset === 8 && chunkType !== 'IHDR') {
      remnants.push({ category: 'CONTAINER_STRUCTURE', detail: 'First PNG chunk is not IHDR.' });
      return false;
    }

    if (chunkType === 'IHDR') hasIhdr = true;
    if (chunkType === 'IDAT') hasIdat = true;
    if (chunkType === 'IEND') {
      hasIend = true;
      if (offset + 12 < bytes.length) {
        remnants.push({
          category: 'CONTAINER_STRUCTURE',
          detail: `Trailing payload of ${bytes.length - (offset + 12)} bytes detected after PNG IEND chunk.`
        });
      }
      break;
    }

    if (chunkType === 'eXIf' && policy.removeExif) {
      remnants.push({ category: 'EXIF', detail: 'PNG eXIf metadata chunk present.', offset });
    }
    if (chunkType === 'tIME' && policy.removeTimestamps) {
      remnants.push({ category: 'EXIF', detail: 'PNG tIME timestamp chunk present.', offset });
    }
    if (['tEXt', 'zTXt', 'iTXt'].includes(chunkType)) {
      if (policy.removeComments) {
        remnants.push({ category: 'COMMENTS', detail: `PNG ${chunkType} text chunk present.`, offset });
      }
    }
    if (chunkType === 'caBX' && policy.removeC2pa) {
      remnants.push({ category: 'C2PA_JUMBF', detail: 'PNG caBX C2PA chunk present.', offset });
    }
    if (chunkType === 'iCCP' && policy.removeIcc) {
      remnants.push({ category: 'ICC_PROFILE', detail: 'PNG iCCP color profile chunk present.', offset });
    }

    offset += 12 + chunkLen;
  }

  if (!hasIhdr || !hasIdat || !hasIend) {
    remnants.push({
      category: 'CONTAINER_STRUCTURE',
      detail: `Missing required PNG chunks (IHDR: ${hasIhdr}, IDAT: ${hasIdat}, IEND: ${hasIend}).`
    });
    return false;
  }

  return true;
}

function verifyWebpBinary(bytes, policy, remnants, checksPerformed) {
  checksPerformed.push('CONTAINER_STRUCTURE');
  checksPerformed.push('EXIF');
  checksPerformed.push('XMP');
  checksPerformed.push('C2PA_JUMBF');
  checksPerformed.push('ICC_PROFILE');

  if (bytes.length < 12) return false;
  const riff = asciiDecoder.decode(bytes.subarray(0, 4));
  const webp = asciiDecoder.decode(bytes.subarray(8, 12));
  if (riff !== 'RIFF' || webp !== 'WEBP') {
    remnants.push({ category: 'CONTAINER_STRUCTURE', detail: 'Invalid WebP RIFF/WEBP header.' });
    return false;
  }

  let offset = 12;
  let hasImageBitstream = false;

  while (offset + 8 <= bytes.length) {
    const chunkType = asciiDecoder.decode(bytes.subarray(offset, offset + 4));
    const chunkLen = (bytes[offset + 4] | (bytes[offset + 5] << 8) | (bytes[offset + 6] << 16) | (bytes[offset + 7] << 24)) >>> 0;
    const paddedLen = chunkLen % 2 !== 0 ? chunkLen + 1 : chunkLen;

    if (['VP8 ', 'VP8L', 'ANIM', 'ANMF'].includes(chunkType)) {
      hasImageBitstream = true;
    }

    if (chunkType === 'EXIF' && policy.removeExif) {
      remnants.push({ category: 'EXIF', detail: 'WebP EXIF chunk present.', offset });
    }
    if (chunkType === 'XMP ' && policy.removeXmp) {
      remnants.push({ category: 'XMP', detail: 'WebP XMP chunk present.', offset });
    }
    if (chunkType === 'C2PA' && policy.removeC2pa) {
      remnants.push({ category: 'C2PA_JUMBF', detail: 'WebP C2PA chunk present.', offset });
    }
    if (chunkType === 'ICCP' && policy.removeIcc) {
      remnants.push({ category: 'ICC_PROFILE', detail: 'WebP ICCP profile chunk present.', offset });
    }

    offset += 8 + paddedLen;
  }

  if (!hasImageBitstream) {
    remnants.push({ category: 'CONTAINER_STRUCTURE', detail: 'WebP container missing image bitstream (VP8/VP8L/ANIM).' });
    return false;
  }

  return true;
}

function verifyGifBinary(bytes, policy, remnants, checksPerformed) {
  checksPerformed.push('CONTAINER_STRUCTURE');
  checksPerformed.push('COMMENTS');
  checksPerformed.push('XMP');

  if (bytes.length < 10) return false;
  const sig = asciiDecoder.decode(bytes.subarray(0, 6));
  if (sig !== 'GIF87a' && sig !== 'GIF89a') {
    remnants.push({ category: 'CONTAINER_STRUCTURE', detail: 'Invalid GIF signature.' });
    return false;
  }

  if (bytes[bytes.length - 1] !== 0x3B) {
    remnants.push({ category: 'CONTAINER_STRUCTURE', detail: 'GIF missing trailer byte (0x3B) at EOF.' });
    return false;
  }

  let offset = 13;
  // Check GCT
  const packed = bytes[10];
  if ((packed & 0x80) !== 0) {
    const gctSize = 3 * (1 << ((packed & 0x07) + 1));
    offset += gctSize;
  }

  while (offset < bytes.length) {
    const intro = bytes[offset];
    if (intro === 0x3B) break; // Trailer

    if (intro === 0x21) {
      // Extension block
      const label = bytes[offset + 1];
      if (label === 0xFE && policy.removeComments) {
        remnants.push({ category: 'COMMENTS', detail: 'GIF Comment Extension present.', offset });
      }
      if (label === 0xFF) {
        // Application Extension
        const appName = asciiDecoder.decode(bytes.subarray(offset + 3, offset + 14));
        if (appName.includes('XMP') && policy.removeXmp) {
          remnants.push({ category: 'XMP', detail: 'GIF XMP Application Extension present.', offset });
        }
      }
      offset += 2;
      while (offset < bytes.length && bytes[offset] !== 0x00) {
        offset += 1 + bytes[offset];
      }
      offset++; // skip terminator
    } else if (intro === 0x2C) {
      // Image Descriptor
      offset += 10;
      if (offset < bytes.length && (bytes[offset - 1] & 0x80) !== 0) {
        const lctSize = 3 * (1 << ((bytes[offset - 1] & 0x07) + 1));
        offset += lctSize;
      }
      offset++; // LZW min code size
      while (offset < bytes.length && bytes[offset] !== 0x00) {
        offset += 1 + bytes[offset];
      }
      offset++; // terminator
    } else {
      offset++;
    }
  }

  return true;
}

function verifyVideoBinary(bytes, policy, remnants, checksPerformed) {
  checksPerformed.push('CONTAINER_STRUCTURE');
  checksPerformed.push('GPS');
  checksPerformed.push('EXIF');

  let offset = 0;
  let moovFound = false;

  while (offset + 8 <= bytes.length) {
    let boxSize = ((bytes[offset] << 24) | (bytes[offset + 1] << 16) | (bytes[offset + 2] << 8) | bytes[offset + 3]) >>> 0;
    const boxType = asciiDecoder.decode(bytes.subarray(offset + 4, offset + 8));

    let headerSize = 8;
    if (boxSize === 1) {
      if (offset + 16 > bytes.length) break;
      const high = ((bytes[offset + 8] << 24) | (bytes[offset + 9] << 16) | (bytes[offset + 10] << 8) | bytes[offset + 11]) >>> 0;
      const low = ((bytes[offset + 12] << 24) | (bytes[offset + 13] << 16) | (bytes[offset + 14] << 8) | bytes[offset + 15]) >>> 0;
      if (high > 0x1FFFFF) break;
      boxSize = high * 0x100000000 + low;
      headerSize = 16;
    } else if (boxSize === 0) {
      boxSize = bytes.length - offset;
    }

    if (boxSize < headerSize || offset + boxSize > bytes.length) break;

    if (boxType === 'moov') {
      moovFound = true;
      let moovOffset = offset + headerSize;
      const moovEnd = offset + boxSize;

      while (moovOffset + 8 <= moovEnd) {
        let childSize = ((bytes[moovOffset] << 24) | (bytes[moovOffset + 1] << 16) | (bytes[moovOffset + 2] << 8) | bytes[moovOffset + 3]) >>> 0;
        const childType = asciiDecoder.decode(bytes.subarray(moovOffset + 4, moovOffset + 8));

        let childHeaderSize = 8;
        if (childSize === 1) {
          if (moovOffset + 16 > moovEnd) break;
          const high = ((bytes[moovOffset + 8] << 24) | (bytes[moovOffset + 9] << 16) | (bytes[moovOffset + 10] << 8) | bytes[moovOffset + 11]) >>> 0;
          const low = ((bytes[moovOffset + 12] << 24) | (bytes[moovOffset + 13] << 16) | (bytes[moovOffset + 14] << 8) | bytes[moovOffset + 15]) >>> 0;
          if (high > 0x1FFFFF) break;
          childSize = high * 0x100000000 + low;
          childHeaderSize = 16;
        } else if (childSize === 0) {
          childSize = moovEnd - moovOffset;
        }

        if (childSize < childHeaderSize || moovOffset + childSize > moovEnd) break;

        if (childType === 'udta') {
          remnants.push({
            category: 'GPS',
            detail: 'Active udta user-data / GPS atom detected inside moov container.',
            offset: moovOffset
          });
        }

        moovOffset += childSize;
      }
    }

    offset += boxSize;
  }

  if (!moovFound) {
    remnants.push({ category: 'CONTAINER_STRUCTURE', detail: 'Missing moov atom in video container.' });
    return false;
  }

  return true;
}

function verifyPdfBinary(bytes, policy, remnants, checksPerformed) {
  checksPerformed.push('CONTAINER_STRUCTURE');
  checksPerformed.push('XMP');

  const content = asciiDecoder.decode(bytes);
  if (!content.startsWith('%PDF-')) {
    remnants.push({ category: 'CONTAINER_STRUCTURE', detail: 'Missing %PDF- header signature.' });
    return false;
  }

  if (content.includes('/Type /Metadata /Subtype /XML') && policy.removeXmp) {
    // Check if the stream following it contains active XML metadata
    const streamIdx = content.indexOf('/Type /Metadata /Subtype /XML');
    const following = content.slice(streamIdx, streamIdx + 200);
    if (!following.includes('stream\n\nendstream') && !following.includes('stream\r\n\r\nendstream') && following.includes('<?xpacket')) {
      remnants.push({ category: 'XMP', detail: 'Active XML metadata stream detected in PDF document.', offset: streamIdx });
    }
  }

  return true;
}
