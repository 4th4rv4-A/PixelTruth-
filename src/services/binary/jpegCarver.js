import piexif from 'piexifjs';
import { createResult, validatePolicy } from './policy.js';

if (typeof window === 'undefined' && typeof self !== 'undefined') {
  self.window = self;
}

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
const EXT_XMP_SIG = textEncoder.encode("http://ns.adobe.com/xmp/extension/\0");
const EXT_XMP_ALT = textEncoder.encode("http://ns.adobe.com/xmp/extension/");
const ICC_SIG = textEncoder.encode("ICC_PROFILE\0");
const JUMBF_SIG = textEncoder.encode("JUMBF");
const JUMB_SIG = textEncoder.encode("jumb");
const C2PA_SIG = textEncoder.encode("c2pa");

function bufferStartsWith(buffer, offset, signature) {
  if (offset + signature.length > buffer.length) return false;
  for (let i = 0; i < signature.length; i++) {
    if (buffer[offset + i] !== signature[i]) return false;
  }
  return true;
}

function isJumbfOrC2paApp11(inputBytes, payloadOffset, segLen) {
  const checkLen = Math.min(segLen - 2, 48);
  for (let i = 0; i <= checkLen - 4; i++) {
    const pos = payloadOffset + i;
    if (
      bufferStartsWith(inputBytes, pos, JUMB_SIG) ||
      bufferStartsWith(inputBytes, pos, JUMBF_SIG) ||
      bufferStartsWith(inputBytes, pos, C2PA_SIG)
    ) {
      return true;
    }
  }
  return false;
}

function getPiexifTagName(ifdName, tagId) {
  const dict = piexif.TAGS ? (piexif.TAGS[ifdName] || (ifdName === '0th' ? piexif.TAGS.Image : null)) : null;
  if (!dict) return null;
  const tagInfo = dict[tagId];
  if (!tagInfo) return null;
  return typeof tagInfo === 'object' ? tagInfo.name : tagInfo;
}

/**
 * Builds a selective APP1 EXIF segment containing ONLY approved tags from keepTags,
 * plus Orientation and ColorSpace.
 */
export function buildSelectiveExifApp1(inputBytes, keepTags = [], targetOrientation = null, targetColorSpace = null) {
  // Find SOS marker to extract only the header portion for piexif.load (saves memory)
  let sosIdx = -1;
  for (let i = 0; i < inputBytes.length - 1; i++) {
    if (inputBytes[i] === 0xFF && inputBytes[i + 1] === MARKERS.SOS) {
      sosIdx = i;
      break;
    }
  }
  if (sosIdx === -1) sosIdx = Math.min(inputBytes.length, 65536);

  const headerChunk = new Uint8Array(sosIdx + 4);
  headerChunk.set(inputBytes.subarray(0, sosIdx), 0);
  headerChunk[sosIdx] = 0xFF; headerChunk[sosIdx + 1] = 0xDA; // SOS
  headerChunk[sosIdx + 2] = 0x00; headerChunk[sosIdx + 3] = 0x02;

  let binStr = '';
  const chunkSize = 8192;
  for (let i = 0; i < headerChunk.length; i += chunkSize) {
    binStr += String.fromCharCode.apply(null, headerChunk.subarray(i, i + chunkSize));
  }

  let exifObj;
  try {
    exifObj = piexif.load(binStr);
  } catch {
    return buildMinimalExifApp1(targetOrientation, targetColorSpace);
  }

  const keepSet = new Set(keepTags);
  const alwaysKeepIfd0 = { 0x0112: true }; // Orientation
  const alwaysKeepExif = { 0xA001: true }; // ColorSpace

  for (const ifdName of ['0th', 'Exif', 'GPS', '1st', 'Interop']) {
    const ifdData = exifObj[ifdName];
    if (!ifdData) continue;

    for (const tagId of Object.keys(ifdData)) {
      const numId = parseInt(tagId, 10);
      if (ifdName === '0th' && alwaysKeepIfd0[numId] && targetOrientation !== null) {
        ifdData[tagId] = targetOrientation;
        continue;
      }
      if (ifdName === 'Exif' && alwaysKeepExif[numId] && targetColorSpace !== null) {
        ifdData[tagId] = targetColorSpace;
        continue;
      }

      const tagName = getPiexifTagName(ifdName, numId);
      if (tagName && keepSet.has(tagName)) {
        continue; // approved tag to retain
      }

      delete ifdData[tagId];
    }
  }

  // Always delete thumbnails and interop
  delete exifObj['1st'];
  delete exifObj['thumbnail'];
  delete exifObj['Interop'];

  // Clean empty GPS if no GPS tag was retained
  if (exifObj.GPS && Object.keys(exifObj.GPS).length === 0) {
    delete exifObj.GPS;
  }

  try {
    const dumped = piexif.dump(exifObj);
    if (!dumped || dumped.length <= 8) {
      return buildMinimalExifApp1(targetOrientation, targetColorSpace);
    }

    const app1Len = 2 + dumped.length;
    const app1 = new Uint8Array(2 + app1Len);
    app1[0] = 0xFF;
    app1[1] = MARKERS.APP1;
    app1[2] = (app1Len >> 8) & 0xFF;
    app1[3] = app1Len & 0xFF;
    for (let i = 0; i < dumped.length; i++) {
      app1[4 + i] = dumped.charCodeAt(i) & 0xFF;
    }
    return app1;
  } catch {
    return buildMinimalExifApp1(targetOrientation, targetColorSpace);
  }
}

/**
 * Parses raw JPEG bytes to extract Orientation (0x0112) and ColorSpace (0xA001) from APP1 EXIF.
 * Supports both Little Endian ('II') and Big Endian ('MM') byte order.
 *
 * @param {Uint8Array} inputBytes
 * @returns {{ orientation: number|null, colorSpace: number|null }}
 */
export function extractExifPreserveTags(inputBytes) {
  let orientation = null;
  let colorSpace = null;

  const len = inputBytes.length;
  if (len < 4 || inputBytes[0] !== 0xFF || inputBytes[1] !== MARKERS.SOI) {
    return { orientation, colorSpace };
  }

  let offset = 2;
  while (offset + 4 <= len) {
    if (inputBytes[offset] !== 0xFF) {
      offset++;
      continue;
    }
    const marker = inputBytes[offset + 1];
    if (marker === MARKERS.EOI || marker === MARKERS.SOS) {
      break;
    }
    if (marker === MARKERS.SOI || marker === 0x00 || (marker >= 0xD0 && marker <= 0xD7)) {
      offset += 2;
      continue;
    }
    const segLen = (inputBytes[offset + 2] << 8) | inputBytes[offset + 3];
    if (segLen < 2 || offset + 2 + segLen > len) break;

    // Check APP1 segment
    if (marker === MARKERS.APP1 && segLen >= 14) {
      const payloadOffset = offset + 4;
      if (bufferStartsWith(inputBytes, payloadOffset, EXIF_SIG)) {
        const tiffStart = offset + 10; // offset + 4 marker/len + 6 "Exif\0\0"
        const tiffLen = segLen - 8;
        const tiffBytes = inputBytes.subarray(tiffStart, tiffStart + tiffLen);
        const tiffView = new DataView(tiffBytes.buffer, tiffBytes.byteOffset, tiffBytes.byteLength);

        if (tiffLen >= 8) {
          let le = null;
          if (tiffBytes[0] === 0x49 && tiffBytes[1] === 0x49) {
            le = true;
          } else if (tiffBytes[0] === 0x4D && tiffBytes[1] === 0x4D) {
            le = false;
          }

          if (le !== null && tiffView.getUint16(2, le) === 42) {
            const ifd0Offset = tiffView.getUint32(4, le);
            if (ifd0Offset >= 8 && ifd0Offset + 2 <= tiffLen) {
              const numEntries = tiffView.getUint16(ifd0Offset, le);
              let exifOffset = null;

              for (let i = 0; i < numEntries; i++) {
                const entryOffset = ifd0Offset + 2 + i * 12;
                if (entryOffset + 12 > tiffLen) break;
                const tag = tiffView.getUint16(entryOffset, le);
                const type = tiffView.getUint16(entryOffset + 2, le);

                if (tag === 0x0112 && orientation === null) {
                  // Orientation: SHORT (3), LONG (4), or BYTE (1)
                  if (type === 3) orientation = tiffView.getUint16(entryOffset + 8, le);
                  else if (type === 4) orientation = tiffView.getUint32(entryOffset + 8, le);
                  else if (type === 1) orientation = tiffView.getUint8(entryOffset + 8);
                } else if (tag === 0x8769 && exifOffset === null) {
                  // Exif IFD Pointer
                  exifOffset = tiffView.getUint32(entryOffset + 8, le);
                }
              }

              if (exifOffset !== null && exifOffset + 2 <= tiffLen) {
                const numExifEntries = tiffView.getUint16(exifOffset, le);
                for (let j = 0; j < numExifEntries; j++) {
                  const subOffset = exifOffset + 2 + j * 12;
                  if (subOffset + 12 > tiffLen) break;
                  const subTag = tiffView.getUint16(subOffset, le);
                  const subType = tiffView.getUint16(subOffset + 2, le);

                  if (subTag === 0xA001 && colorSpace === null) {
                    // ColorSpace
                    if (subType === 3) colorSpace = tiffView.getUint16(subOffset + 8, le);
                    else if (subType === 4) colorSpace = tiffView.getUint32(subOffset + 8, le);
                  }
                }
              }
            }
          }
        }
      }
    }

    offset += 2 + segLen;
  }

  return { orientation, colorSpace };
}

/**
 * Builds a minimal, freshly-constructed JPEG APP1 EXIF segment containing ONLY
 * the provided Orientation and/or ColorSpace tags.
 *
 * Direct byte construction: deterministic, zero round-tripping through data URLs or base64.
 *
 * @param {number|null} orientation - Orientation value (1-8), if present
 * @param {number|null} colorSpace - ColorSpace value, if present
 * @returns {Uint8Array|null} Freshly constructed APP1 segment or null if neither tag exists
 */
export function buildMinimalExifApp1(orientation, colorSpace) {
  const hasOrientation = orientation !== undefined && orientation !== null;
  const hasColorSpace = colorSpace !== undefined && colorSpace !== null;
  if (!hasOrientation && !hasColorSpace) return null;

  const numIfd0 = (hasOrientation ? 1 : 0) + (hasColorSpace ? 1 : 0);
  const ifd0Offset = 8;
  const ifd0Size = 2 + (numIfd0 * 12) + 4;
  const exifIfdOffset = ifd0Offset + ifd0Size;
  const exifIfdSize = hasColorSpace ? (2 + 12 + 4) : 0;
  const tiffSize = exifIfdOffset + exifIfdSize;

  // APP1 Marker (2) + length (2) + Exif\0\0 (6) + tiffSize
  const totalSegLength = 2 + 2 + 6 + tiffSize;
  const seg = new Uint8Array(totalSegLength);
  const view = new DataView(seg.buffer);

  // Marker 0xFFE1
  seg[0] = 0xFF;
  seg[1] = MARKERS.APP1;

  // Length word (big endian, includes length word itself)
  const app1PayloadLen = 2 + 6 + tiffSize;
  view.setUint16(2, app1PayloadLen, false);

  // "Exif\0\0"
  seg[4] = 0x45; // E
  seg[5] = 0x78; // x
  seg[6] = 0x69; // i
  seg[7] = 0x66; // f
  seg[8] = 0x00;
  seg[9] = 0x00;

  // TIFF Header at offset 10 (Little Endian 'II')
  const tiffBase = 10;
  seg[tiffBase] = 0x49;     // 'I'
  seg[tiffBase + 1] = 0x49; // 'I'
  view.setUint16(tiffBase + 2, 42, true);
  view.setUint32(tiffBase + 4, ifd0Offset, true); // IFD0 offset = 8

  // IFD0
  view.setUint16(tiffBase + ifd0Offset, numIfd0, true);

  let entryIdx = 0;
  if (hasOrientation) {
    const entryOffset = tiffBase + ifd0Offset + 2 + entryIdx * 12;
    view.setUint16(entryOffset, 0x0112, true);          // Tag: Orientation
    view.setUint16(entryOffset + 2, 3, true);            // Type: SHORT (3)
    view.setUint32(entryOffset + 4, 1, true);            // Count: 1
    view.setUint16(entryOffset + 8, orientation, true);  // Value
    view.setUint16(entryOffset + 10, 0, true);           // Padding
    entryIdx++;
  }

  if (hasColorSpace) {
    const entryOffset = tiffBase + ifd0Offset + 2 + entryIdx * 12;
    view.setUint16(entryOffset, 0x8769, true);           // Tag: Exif IFD Pointer
    view.setUint16(entryOffset + 2, 4, true);            // Type: LONG (4)
    view.setUint32(entryOffset + 4, 1, true);            // Count: 1
    view.setUint32(entryOffset + 8, exifIfdOffset, true);// Value: Offset to Exif IFD
    entryIdx++;
  }

  // Next IFD = 0
  view.setUint32(tiffBase + ifd0Offset + 2 + entryIdx * 12, 0, true);

  // Exif IFD
  if (hasColorSpace) {
    const exifIfdBase = tiffBase + exifIfdOffset;
    view.setUint16(exifIfdBase, 1, true); // 1 entry
    const entryOffset = exifIfdBase + 2;
    view.setUint16(entryOffset, 0xA001, true);          // Tag: ColorSpace
    view.setUint16(entryOffset + 2, 3, true);           // Type: SHORT (3)
    view.setUint32(entryOffset + 4, 1, true);           // Count: 1
    view.setUint16(entryOffset + 8, colorSpace, true);  // Value
    view.setUint16(entryOffset + 10, 0, true);          // Padding
    view.setUint32(entryOffset + 12, 0, true);          // Next IFD = 0
  }

  return seg;
}

/**
 * Parses and selectively copies JPEG segments, preserving SOS to EOI bitstream.
 * When stripping EXIF, preserves Orientation and ColorSpace by constructing a minimal APP1.
 */
export function sanitizeJpeg(inputBytes, rawPolicy = {}) {
  const policy = validatePolicy(rawPolicy);
  const result = {
    format: 'jpeg',
    inputBytes,
    outputBytes: null,
    removedSegments: [],
    preservedSegments: [],
    imageBitstreamChanged: false,
    warnings: [],
    status: 'success'
  };

  const len = inputBytes.length;
  if (len < 2 || inputBytes[0] !== 0xFF || inputBytes[1] !== MARKERS.SOI) {
    result.status = 'malformed';
    result.error = 'Not a valid JPEG (missing SOI).';
    return createResult(result);
  }

  const preserveOrientation = policy.preserveOrientation;
  const preserveColorSpace = policy.preserveColorSpace;

  // Read Orientation and ColorSpace before carving
  const { orientation, colorSpace } = (preserveOrientation || preserveColorSpace)
    ? extractExifPreserveTags(inputBytes)
    : { orientation: null, colorSpace: null };

  const targetOrientation = preserveOrientation ? orientation : null;
  const targetColorSpace = preserveColorSpace ? colorSpace : null;

  const outputChunks = [];
  // Add SOI
  outputChunks.push(inputBytes.subarray(0, 2));

  let offset = 2;
  let sosReached = false;
  let minimalApp1Injected = false;

  let segmentCount = 0;
  const MAX_SEGMENTS = 2000;

  while (offset < len) {
    if (segmentCount++ > MAX_SEGMENTS) {
      result.status = 'malformed';
      result.error = 'Exceeded maximum number of segments (possible DOS).';
      return createResult(result);
    }

    if (inputBytes[offset] !== 0xFF) {
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
      if (marker === MARKERS.EOI) break;
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
      // Scan entropy-coded scan data for the true EOI (0xFF 0xD9) marker to truncate any trailing payloads.
      const sosSegLen = (inputBytes[offset + 2] << 8) | inputBytes[offset + 3];
      const scanStart = offset + 2 + sosSegLen;
      
      let eoiOffset = -1;
      let scanIdx = scanStart;
      while (scanIdx < len - 1) {
        if (inputBytes[scanIdx] === 0xFF) {
          const next = inputBytes[scanIdx + 1];
          if (next === MARKERS.EOI) {
            eoiOffset = scanIdx;
            break;
          } else if (next === 0x00 || (next >= 0xD0 && next <= 0xD7)) {
            // Byte-stuffed 0xFF 0x00 or restart marker (RST0-RST7)
            scanIdx += 2;
            continue;
          } else if (next === 0xFF) {
            // Consecutive fill bytes
            scanIdx++;
            continue;
          } else {
            // Other marker in multi-scan progressive JPEG
            scanIdx += 2;
            continue;
          }
        } else {
          scanIdx++;
        }
      }

      if (eoiOffset === -1) {
        result.status = 'malformed';
        result.error = 'Never reached EOI (End of Image). File may be truncated.';
        return createResult(result);
      }

      const bitstreamEnd = eoiOffset + 2;
      outputChunks.push(inputBytes.subarray(offset, bitstreamEnd));
      result.preservedSegments.push({ type: 'SOS_AND_BITSTREAM', offset, size: bitstreamEnd - offset });
      sosReached = true;

      if (bitstreamEnd < len) {
        const trailingSize = len - bitstreamEnd;
        result.removedSegments.push({ type: 'TRAILING_PAYLOAD', offset: bitstreamEnd, size: trailingSize });
        result.warnings.push(`Detected and removed ${trailingSize} bytes of trailing non-image data after EOI.`);
      }
      break;
    } else if (marker === MARKERS.COM) {
      typeDesc = 'COM';
      if (policy.removeComments) {
        keep = false;
      }
    } else if (marker === MARKERS.APP1) {
      if (bufferStartsWith(inputBytes, payloadOffset, EXIF_SIG)) {
        typeDesc = 'APP1_EXIF';
        if (policy.removeExif) {
          keep = false;
          // Splice in selective or minimal freshly built APP1
          if (!minimalApp1Injected) {
            const hasKeepTags = Array.isArray(policy.keepTags) && policy.keepTags.length > 0;
            const app1ToInject = hasKeepTags
              ? buildSelectiveExifApp1(inputBytes, policy.keepTags, targetOrientation, targetColorSpace)
              : ((targetOrientation !== null || targetColorSpace !== null) ? buildMinimalExifApp1(targetOrientation, targetColorSpace) : null);

            if (app1ToInject) {
              outputChunks.push(app1ToInject);
              result.preservedSegments.push({
                type: hasKeepTags ? 'APP1_EXIF_SELECTIVE' : 'APP1_EXIF_MINIMAL',
                offset,
                size: app1ToInject.length,
              });
              minimalApp1Injected = true;
            }
          }
        }
      } else if (
        bufferStartsWith(inputBytes, payloadOffset, XMP_SIG) ||
        bufferStartsWith(inputBytes, payloadOffset, EXT_XMP_SIG) ||
        bufferStartsWith(inputBytes, payloadOffset, EXT_XMP_ALT)
      ) {
        typeDesc = 'APP1_XMP';
        if (policy.removeXmp) keep = false;
      } else {
        typeDesc = 'APP1_METADATA';
        // Under strict metadata removal, non-standard APP1 segments are metadata and stripped
        if (policy.removeExif || policy.removeXmp) keep = false;
      }
    } else if (marker === MARKERS.APP2) {
      if (bufferStartsWith(inputBytes, payloadOffset, ICC_SIG)) {
        typeDesc = 'APP2_ICC';
        if (policy.removeIcc) keep = false;
      }
    } else if (marker === MARKERS.APP13 || marker === MARKERS.APP14) {
      typeDesc = `APP${marker - 0xE0}`;
      if (policy.removeIptc && marker === MARKERS.APP13) keep = false;
    } else if (marker === MARKERS.APP11) {
      // APP11: check if it carries a C2PA / JUMBF Content Credentials manifest.
      if (isJumbfOrC2paApp11(inputBytes, payloadOffset, segLen)) {
        typeDesc = 'APP11_C2PA';
        if (policy.removeC2pa) keep = false;
      } else {
        typeDesc = 'APP11_VENDOR';
      }
    } else if (marker >= 0xE0 && marker <= 0xEF) {
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
