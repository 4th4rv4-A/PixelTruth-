const textDecoder = new TextDecoder('ascii');
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

export function parseJpeg(inputBytes) {
  const len = inputBytes.length;
  if (len < 2 || inputBytes[0] !== 0xFF || inputBytes[1] !== 0xD8) {
    throw new Error('Not a valid JPEG');
  }

  const segments = [];
  segments.push({ id: `0`, name: 'SOI', category: 'structure', offset: 0, size: 2 });

  let offset = 2;
  let segmentId = 1;

  while (offset < len) {
    if (inputBytes[offset] !== 0xFF) {
      offset++;
      continue;
    }

    const marker = inputBytes[offset + 1];
    
    if (marker === 0xFF) {
      offset++;
      continue;
    }

    if (marker === 0xD8 || marker === 0x00 || marker === 0xD9 || (marker >= 0xD0 && marker <= 0xD7)) {
      const name = marker === 0xD9 ? 'EOI' : `Standalone_FF${marker.toString(16).toUpperCase()}`;
      segments.push({ id: `${segmentId++}`, name, category: 'structure', offset, size: 2 });
      offset += 2;
      if (marker === 0xD9) break;
      continue;
    }

    if (offset + 4 > len) break;

    const segLen = (inputBytes[offset + 2] << 8) | inputBytes[offset + 3];
    const size = segLen + 2;
    const payloadOffset = offset + 4;
    
    let name = `APP${marker - 0xE0}`;
    let category = 'metadata';

    if (marker === 0xDA) {
      name = 'SOS';
      category = 'image';
      segments.push({ id: `${segmentId++}`, name, category, offset, size: len - offset });
      break; 
    } else if (marker === 0xFE) {
      name = 'COM';
    } else if (marker === 0xDB) {
      name = 'DQT';
      category = 'image';
    } else if (marker === 0xC4) {
      name = 'DHT';
      category = 'image';
    } else if (marker >= 0xC0 && marker <= 0xC3) {
      name = `SOF${marker - 0xC0}`;
      category = 'image';
    } else if (marker === 0xE1) {
      if (bufferStartsWith(inputBytes, payloadOffset, EXIF_SIG)) name = 'APP1 (EXIF)';
      else if (bufferStartsWith(inputBytes, payloadOffset, XMP_SIG)) name = 'APP1 (XMP)';
      else name = 'APP1 (Unknown)';
    } else if (marker === 0xE2) {
      if (bufferStartsWith(inputBytes, payloadOffset, ICC_SIG)) name = 'APP2 (ICC Profile)';
    } else if (marker === 0xEB) {
      let isC2pa = false;
      for (let i = 0; i < 32 && payloadOffset + i + 5 <= offset + size; i++) {
         if (bufferStartsWith(inputBytes, payloadOffset + i, JUMBF_SIG)) {
            isC2pa = true; break;
         }
      }
      if (isC2pa) {
        name = 'APP11 (C2PA/JUMBF)';
        category = 'c2pa';
      }
    } else if (marker === 0xED) {
      name = 'APP13 (IPTC/IRB)';
    } else {
      if (marker >= 0xE0 && marker <= 0xEF) name = `APP${marker - 0xE0}`;
      else name = `FF${marker.toString(16).toUpperCase()}`;
      category = 'structure';
    }

    segments.push({ id: `${segmentId++}`, name, category, offset, size });
    offset += size;
  }

  return segments;
}


export function parsePng(inputBytes) {
  const len = inputBytes.length;
  if (len < 8) throw new Error('File too small');
  
  const segments = [];
  segments.push({ id: '0', name: 'Signature', category: 'structure', offset: 0, size: 8 });
  
  let offset = 8;
  let segmentId = 1;

  while (offset < len) {
    if (offset + 8 > len) break;
    const chunkLen = (inputBytes[offset] << 24) | (inputBytes[offset + 1] << 16) | (inputBytes[offset + 2] << 8) | (inputBytes[offset + 3]);
    if (chunkLen < 0) break;
    
    const chunkTypeBytes = inputBytes.subarray(offset + 4, offset + 8);
    const chunkType = textDecoder.decode(chunkTypeBytes);
    const size = chunkLen + 12; // length + type + data + crc
    
    if (offset + size > len) break;

    let category = 'metadata';
    const isCritical = (chunkTypeBytes[0] & 32) === 0;
    if (isCritical) {
      category = chunkType === 'IDAT' ? 'image' : 'structure';
    } else if (chunkType === 'caBX' || chunkType === 'c2pa') {
      category = 'c2pa';
    }

    segments.push({ id: `${segmentId++}`, name: chunkType, category, offset, size });
    offset += size;
    if (chunkType === 'IEND') break;
  }
  return segments;
}

export function parseWebp(inputBytes) {
  const len = inputBytes.length;
  if (len < 12) throw new Error('File too small');
  
  const riffSig = textDecoder.decode(inputBytes.subarray(0, 4));
  const webpSig = textDecoder.decode(inputBytes.subarray(8, 12));
  if (riffSig !== 'RIFF' || webpSig !== 'WEBP') throw new Error('Not WebP');

  const segments = [];
  segments.push({ id: '0', name: 'RIFF/WEBP Header', category: 'structure', offset: 0, size: 12 });
  
  const declaredSize = inputBytes[4] | (inputBytes[5] << 8) | (inputBytes[6] << 16) | (inputBytes[7] << 24);
  let offset = 12;
  let segmentId = 1;

  while (offset < len && offset < declaredSize + 8) {
    if (offset + 8 > len) break;
    const chunkType = textDecoder.decode(inputBytes.subarray(offset, offset + 4));
    const chunkSize = inputBytes[offset + 4] | (inputBytes[offset + 5] << 8) | (inputBytes[offset + 6] << 16) | (inputBytes[offset + 7] << 24);
    if (chunkSize < 0) break;

    const paddedSize = chunkSize % 2 !== 0 ? chunkSize + 1 : chunkSize;
    const size = paddedSize + 8;
    if (offset + size > len) break;

    let category = 'metadata';
    if (['VP8 ', 'VP8L', 'VP8X', 'ALPH', 'ANIM', 'ANMF'].includes(chunkType)) {
      category = 'image';
    } else if (chunkType === 'ICCP') {
      category = 'metadata';
    }

    segments.push({ id: `${segmentId++}`, name: chunkType.trim(), category, offset, size });
    offset += size;
  }
  return segments;
}

export function parseStructure(buffer, mime) {
  const bytes = new Uint8Array(buffer);
  if (mime === 'image/jpeg') return parseJpeg(bytes);
  if (mime === 'image/png') return parsePng(bytes);
  if (mime === 'image/webp') return parseWebp(bytes);
  return [];
}
