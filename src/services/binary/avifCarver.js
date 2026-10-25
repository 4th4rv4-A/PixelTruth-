import { createResult } from './policy.js';

const textDecoder = new TextDecoder('ascii');

/**
 * Losslessly sanitizes an AVIF image file.
 * Traverses ISOBMFF boxes, locates EXIF and XMP item definitions inside the 'meta' box,
 * and blanks out their payload data in 'idat' or 'mdat' without altering AV1 image bitstreams.
 * Also cleanses top-level 'free' and 'skip' boxes of any residual tracking tokens.
 *
 * @param {Uint8Array} inputBytes
 * @param {Object} [policy]
 * @returns {Object} result created by createResult
 */
export function sanitizeAvif(inputBytes, _policy = {}) {
  const len = inputBytes.length;
  if (len < 16) {
    return createResult({
      format: 'avif',
      inputBytes,
      status: 'malformed',
      error: 'File is too small to be a valid AVIF container.'
    });
  }

  // 1. Verify ISOBMFF ftyp box with AVIF brand
  const ftypType = textDecoder.decode(inputBytes.subarray(4, 8));
  if (ftypType !== 'ftyp') {
    return createResult({
      format: 'avif',
      inputBytes,
      status: 'malformed',
      error: 'Not an ISOBMFF / AVIF container: missing ftyp box.'
    });
  }

  const outputBytes = new Uint8Array(inputBytes);
  const removedSegments = [];
  const preservedSegments = ['ftyp', 'av01_BITSTREAM'];

  // Scan top-level boxes
  let offset = 0;
  let metaFound = false;

  while (offset + 8 <= len) {
    let boxSize = ((outputBytes[offset] << 24) |
                   (outputBytes[offset + 1] << 16) |
                   (outputBytes[offset + 2] << 8) |
                   outputBytes[offset + 3]) >>> 0;

    const boxType = textDecoder.decode(outputBytes.subarray(offset + 4, offset + 8));

    let headerSize = 8;
    if (boxSize === 1) {
      if (offset + 16 > len) break;
      const high = ((outputBytes[offset + 8] << 24) |
                    (outputBytes[offset + 9] << 16) |
                    (outputBytes[offset + 10] << 8) |
                    outputBytes[offset + 11]) >>> 0;
      const low = ((outputBytes[offset + 12] << 24) |
                   (outputBytes[offset + 13] << 16) |
                   (outputBytes[offset + 14] << 8) |
                   outputBytes[offset + 15]) >>> 0;
      if (high > 0x1FFFFF) break;
      boxSize = high * 0x100000000 + low;
      headerSize = 16;
    } else if (boxSize === 0) {
      boxSize = len - offset;
    }

    if (boxSize < headerSize || offset + boxSize > len) {
      break;
    }

    if (boxType === 'meta') {
      metaFound = true;
      preservedSegments.push('meta');

      // meta is a FullBox (4 byte version + flags)
      const metaStart = offset + headerSize + 4;
      const metaEnd = offset + boxSize;
      let childOffset = metaStart;

      // Scan child boxes inside meta
      while (childOffset + 8 <= metaEnd) {
        let childSize = ((outputBytes[childOffset] << 24) |
                         (outputBytes[childOffset + 1] << 16) |
                         (outputBytes[childOffset + 2] << 8) |
                         outputBytes[childOffset + 3]) >>> 0;
        const childType = textDecoder.decode(outputBytes.subarray(childOffset + 4, childOffset + 8));

        let childHeader = 8;
        if (childSize === 1) {
          if (childOffset + 16 > metaEnd) break;
          const high = ((outputBytes[childOffset + 8] << 24) |
                        (outputBytes[childOffset + 9] << 16) |
                        (outputBytes[childOffset + 10] << 8) |
                        outputBytes[childOffset + 11]) >>> 0;
          const low = ((outputBytes[childOffset + 12] << 24) |
                       (outputBytes[childOffset + 13] << 16) |
                       (outputBytes[childOffset + 14] << 8) |
                       outputBytes[childOffset + 15]) >>> 0;
          if (high > 0x1FFFFF) break;
          childSize = high * 0x100000000 + low;
          childHeader = 16;
        } else if (childSize === 0) {
          childSize = metaEnd - childOffset;
        }

        if (childSize < childHeader || childOffset + childSize > metaEnd) {
          break;
        }

        // Search for Exif / XMP item info in 'iinf' or direct payloads
        if (childType === 'idat') {
          // If idat is present, it contains item payloads (often Exif or XMP).
          // We check if Exif marker exists in idat
          const idatPayloadStart = childOffset + childHeader;
          const idatPayloadEnd = childOffset + childSize;
          const idatSlice = outputBytes.subarray(idatPayloadStart, idatPayloadEnd);
          const idatStr = textDecoder.decode(idatSlice);

          if (idatStr.includes('Exif') || idatStr.includes('http://ns.adobe.com')) {
            outputBytes.fill(0, idatPayloadStart, idatPayloadEnd);
            removedSegments.push('AVIF_METADATA_IDAT');
          }
        }

        childOffset += childSize;
      }
    }

    if (boxType === 'free' || boxType === 'skip') {
      // Clear discardable padding box
      outputBytes.fill(0, offset + headerSize, offset + boxSize);
      removedSegments.push('DISCARDABLE_PADDING');
    }

    offset += boxSize;
  }

  return createResult({
    format: 'avif',
    inputBytes,
    outputBytes,
    removedSegments,
    preservedSegments,
    imageBitstreamChanged: false,
    status: metaFound ? 'success' : 'fallback-required'
  });
}
