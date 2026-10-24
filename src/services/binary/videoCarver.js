import { createResult } from './policy.js';

const textDecoder = new TextDecoder('ascii');

/**
 * Losslessly sanitizes an MP4 or QuickTime MOV video container.
 * Traverses ISOBMFF boxes, locates the User Data ('udta') box inside 'moov',
 * and converts it into a harmless 'free' (padding) box with zeroed payload bytes.
 *
 * By maintaining the exact box length and structure, chunk offsets ('stco' and 'co64')
 * remain 100% valid, ensuring instant playback without re-encoding video or audio tracks.
 *
 * @param {Uint8Array} inputBytes
 * @param {Object} [policy]
 * @returns {Object} result created by createResult
 */
export function sanitizeVideo(inputBytes, _policy = {}) {
  const len = inputBytes.length;
  if (len < 16) {
    return createResult({
      format: 'video',
      inputBytes,
      status: 'malformed',
      error: 'File is too small to be a valid MP4/MOV container.'
    });
  }

  // 1. Verify ISOBMFF ftyp box
  const ftypType = textDecoder.decode(inputBytes.subarray(4, 8));
  if (ftypType !== 'ftyp') {
    return createResult({
      format: 'video',
      inputBytes,
      status: 'malformed',
      error: 'Not an ISOBMFF / MP4 / QuickTime MOV container (missing ftyp).'
    });
  }

  const majorBrand = textDecoder.decode(inputBytes.subarray(8, 12));
  const isMov = majorBrand === 'qt  ';
  const format = isMov ? 'mov' : 'mp4';

  // Work on a copy of the input bytes so we mutate in-place safely
  const outputBytes = new Uint8Array(inputBytes);
  const removedSegments = [];
  const preservedSegments = ['ftyp', 'mdat', 'trak'];

  let offset = 0;
  let moovFound = false;

  while (offset + 8 <= len) {
    let boxSize = ((outputBytes[offset] << 24) |
                   (outputBytes[offset + 1] << 16) |
                   (outputBytes[offset + 2] << 8) |
                   outputBytes[offset + 3]) >>> 0;

    const boxType = textDecoder.decode(outputBytes.subarray(offset + 4, offset + 8));

    let headerSize = 8;
    if (boxSize === 1) {
      // 64-bit size
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
      // Box extends to end of file
      boxSize = len - offset;
    }

    if (boxSize < headerSize || offset + boxSize > len) {
      break; // malformed box boundary
    }

    if (boxType === 'moov') {
      moovFound = true;
      preservedSegments.push('moov');

      // Traverse children inside moov
      let moovOffset = offset + headerSize;
      const moovEnd = offset + boxSize;

      while (moovOffset + 8 <= moovEnd) {
        let childSize = ((outputBytes[moovOffset] << 24) |
                         (outputBytes[moovOffset + 1] << 16) |
                         (outputBytes[moovOffset + 2] << 8) |
                         outputBytes[moovOffset + 3]) >>> 0;

        const childType = textDecoder.decode(outputBytes.subarray(moovOffset + 4, moovOffset + 8));

        let childHeaderSize = 8;
        if (childSize === 1) {
          if (moovOffset + 16 > moovEnd) break;
          const high = ((outputBytes[moovOffset + 8] << 24) |
                        (outputBytes[moovOffset + 9] << 16) |
                        (outputBytes[moovOffset + 10] << 8) |
                        outputBytes[moovOffset + 11]) >>> 0;
          const low = ((outputBytes[moovOffset + 12] << 24) |
                       (outputBytes[moovOffset + 13] << 16) |
                       (outputBytes[moovOffset + 14] << 8) |
                       outputBytes[moovOffset + 15]) >>> 0;
          if (high > 0x1FFFFF) break;
          childSize = high * 0x100000000 + low;
          childHeaderSize = 16;
        } else if (childSize === 0) {
          childSize = moovEnd - moovOffset;
        }

        if (childSize < childHeaderSize || moovOffset + childSize > moovEnd) {
          break;
        }

        if (childType === 'udta') {
          // Transform 'udta' into 'free' box of identical size and zero out payload
          // Replace 'udta' with 'free' (0x66, 0x72, 0x65, 0x65)
          outputBytes[moovOffset + 4] = 0x66; // 'f'
          outputBytes[moovOffset + 5] = 0x72; // 'r'
          outputBytes[moovOffset + 6] = 0x65; // 'e'
          outputBytes[moovOffset + 7] = 0x65; // 'e'

          // Zero out payload bytes
          const payloadStart = moovOffset + childHeaderSize;
          const payloadEnd = moovOffset + childSize;
          outputBytes.fill(0, payloadStart, payloadEnd);

          removedSegments.push('UDTA_USER_DATA');
          removedSegments.push('GPS_COORDINATES');
          removedSegments.push('METADATA_ATOMS');
        }

        moovOffset += childSize;
      }
    }

    offset += boxSize;
  }

  if (!moovFound) {
    return createResult({
      format,
      inputBytes,
      status: 'malformed',
      error: 'Invalid video container: missing moov atom.'
    });
  }

  return createResult({
    format,
    inputBytes,
    outputBytes,
    removedSegments,
    preservedSegments,
    imageBitstreamChanged: false,
    status: 'success'
  });
}
