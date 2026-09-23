import { createResult } from './policy.js';

const MARKERS = {
  SOI: 0xD8,
  EOI: 0xD9,
  SOS: 0xDA,
  COM: 0xFE,
  APP0: 0xE0,
  APP1: 0xE1,
  APP2: 0xE2,
  APP11: 0xEB,
  APP13: 0xED, // Often IPTC / Photoshop IRB
  APP14: 0xEE,
};

const textEncoder = new TextEncoder();
const EXIF_SIG = textEncoder.encode("Exif\0\0");
const XMP_SIG = textEncoder.encode("http://ns.adobe.com/xap/1.0/\0");
const ICC_SIG = textEncoder.encode("ICC_PROFILE\0");
const JUMBF_SIG = textEncoder.encode("JUMBF");

function bufferStartsWith(buffer, offset, signature) {
  if (offset + signature.length > buffer.length) return false;
  for (let i = 0; i < signature.length; i++) {
    if (buffer[offset + i] !== signature[i]) return false;
  }
  return true;
}

/**
 * Parses and selectively copies JPEG segments, preserving SOS to EOI bitstream.
 */
export function sanitizeJpeg(inputBytes, policy) {
  const result = {
    format: 'jpeg',
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
  if (len < 2 || inputBytes[0] !== 0xFF || inputBytes[1] !== MARKERS.SOI) {
    result.status = 'malformed';
    result.error = 'Not a valid JPEG (missing SOI).';
    return createResult(result);
  }

  const outputChunks = [];
  // Add SOI
  outputChunks.push(inputBytes.subarray(0, 2));

  let offset = 2;
  let sosReached = false;

  // Set limits to prevent infinite loops or DOS
  let segmentCount = 0;
  const MAX_SEGMENTS = 2000;

  while (offset < len) {
    if (segmentCount++ > MAX_SEGMENTS) {
      result.status = 'malformed';
      result.error = 'Exceeded maximum number of segments (possible DOS).';
      return createResult(result);
    }

    if (inputBytes[offset] !== 0xFF) {
      // Find the next 0xFF safely. This shouldn't normally happen in the header,
      // but some malformed JPEGs have padding.
      offset++;
      continue;
    }

    const marker = inputBytes[offset + 1];
    
    // Padding bytes (0xFF)
    if (marker === 0xFF) {
      offset++;
      continue;
    }

    // Standalone markers
    if (marker === MARKERS.SOI || marker === 0x00 || marker === MARKERS.EOI || (marker >= 0xD0 && marker <= 0xD7)) {
      outputChunks.push(inputBytes.subarray(offset, offset + 2));
      offset += 2;
      if (marker === MARKERS.EOI) break; // Reached end
      continue;
    }

    // Segment with length
    if (offset + 4 > len) {
      result.status = 'malformed';
      result.error = 'Truncated segment header.';
      return createResult(result);
    }

    const segLen = (inputBytes[offset + 2] << 8) | inputBytes[offset + 3];
    const nextOffset = offset + 2 + segLen;

    if (nextOffset > len) {
      result.status = 'malformed';
      result.error = `Segment 0xFF${marker.toString(16).toUpperCase()} exceeds file length.`;
      return createResult(result);
    }

    const segmentData = inputBytes.subarray(offset, nextOffset);
    const payloadOffset = offset + 4; // Data after length

    let keep = true;
    let typeDesc = `0xFF${marker.toString(16).toUpperCase()}`;

    if (marker === MARKERS.SOS) {
      // SOS reached. Everything from here to EOI is image data.
      // We don't parse the entropy coded data, we just copy the rest of the file.
      // (Strictly speaking, we could scan for EOI, but safely copying to EOF preserves the bitstream perfectly).
      outputChunks.push(inputBytes.subarray(offset, len));
      result.preservedSegments.push({ type: 'SOS_AND_BITSTREAM', offset, size: len - offset });
      sosReached = true;
      break; 
    } else if (marker === MARKERS.COM) {
      typeDesc = 'COM';
      if (policy.removeComments) {
        keep = false;
      }
    } else if (marker === MARKERS.APP1) {
      if (bufferStartsWith(inputBytes, payloadOffset, EXIF_SIG)) {
        typeDesc = 'APP1_EXIF';
        if (policy.removeExif) keep = false;
      } else if (bufferStartsWith(inputBytes, payloadOffset, XMP_SIG)) {
        typeDesc = 'APP1_XMP';
        if (policy.removeXmp) keep = false;
      } else {
        typeDesc = 'APP1_UNKNOWN';
        // By default, preserve unknown APP1 unless we want to scrub everything,
        // but policy usually specifies specific tags.
      }
    } else if (marker === MARKERS.APP2) {
      if (bufferStartsWith(inputBytes, payloadOffset, ICC_SIG)) {
        typeDesc = 'APP2_ICC';
        if (policy.removeIcc) keep = false;
      }
    } else if (marker === MARKERS.APP11) {
      // Typically JUMBF (C2PA) has a payload where JUMBF box can be found.
      // We do a loose search in the first few bytes.
      let isC2pa = false;
      for(let i = 0; i < 32 && payloadOffset + i + 5 <= nextOffset; i++) {
         if (bufferStartsWith(inputBytes, payloadOffset + i, JUMBF_SIG)) {
            isC2pa = true;
            break;
         }
      }
      
      if (isC2pa) {
        typeDesc = 'APP11_C2PA';
        if (policy.removeC2pa) keep = false;
        if (policy.preserveC2pa) {
            keep = true;
            result.c2paPreserved = true;
        }
      }
    } else if (marker === MARKERS.APP13 || marker === MARKERS.APP14) {
      // Often IPTC or Adobe IRB
      typeDesc = `APP${marker - 0xE0}`;
      if (policy.removeIptc && marker === MARKERS.APP13) keep = false;
    } else if (marker >= 0xE0 && marker <= 0xEF) {
       // Other APPs
       typeDesc = `APP${marker - 0xE0}`;
    }

    if (keep) {
      outputChunks.push(segmentData);
      result.preservedSegments.push({ type: typeDesc, offset, size: nextOffset - offset });
    } else {
      result.removedSegments.push({ type: typeDesc, offset, size: nextOffset - offset });
    }

    offset = nextOffset;
  }

  if (!sosReached) {
    result.status = 'malformed';
    result.error = 'Never reached SOS (Start of Scan). File may be truncated.';
    return createResult(result);
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
