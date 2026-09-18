import piexif from 'piexifjs';

/**
 * Full strip — draw image onto canvas, re-export as clean blob.
 * Works for all formats. Strips ALL metadata.
 * @param {File} file - already normalized (no HEIC)
 * @returns {Promise<Blob>}
 */
export async function stripFull(file) {
  const img = await createImageBitmap(file);
  const canvas = document.createElement('canvas');
  canvas.width = img.width;
  canvas.height = img.height;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(img, 0, 0);
  img.close();

  return new Promise((resolve) => {
    const mimeType = file.type === 'image/png' ? 'image/png' : 'image/jpeg';
    const quality = mimeType === 'image/png' ? undefined : 0.95;
    canvas.toBlob((blob) => resolve(blob), mimeType, quality);
  });
}

/**
 * Selective strip — JPEG only. Remove unchecked EXIF tags, keep checked ones.
 * Orientation and ColorSpace are always preserved.
 * @param {File} file - must be JPEG
 * @param {string[]} keepTags - tag names to preserve
 * @returns {Promise<Blob>}
 */
export async function stripSelective(file, keepTags = []) {
  const arrayBuffer = await file.arrayBuffer();
  const dataUrl = arrayBufferToDataUrl(arrayBuffer, 'image/jpeg');

  let exifObj;
  try {
    exifObj = piexif.load(dataUrl);
  } catch {
    // If piexif can't parse, fall back to full strip
    return stripFull(file);
  }

  // Always keep Orientation (0x0112) and ColorSpace (0xA001)
  const alwaysKeepIfd0 = { 0x0112: true }; // Orientation
  const alwaysKeepExif = { 0xA001: true };  // ColorSpace

  // Map of human-readable tag names to their piexif IFD + tag ID
  const tagMap = buildTagMap();

  // Build set of tag keys to keep
  const keepSet = new Set(keepTags);

  // Iterate all IFDs and remove tags not in keepSet (except always-keep)
  for (const ifdName of ['0th', 'Exif', 'GPS', '1st', 'Interop']) {
    const ifdData = exifObj[ifdName];
    if (!ifdData) continue;

    for (const tagId of Object.keys(ifdData)) {
      const numId = parseInt(tagId, 10);

      // Always keep orientation and colorspace
      if (ifdName === '0th' && alwaysKeepIfd0[numId]) continue;
      if (ifdName === 'Exif' && alwaysKeepExif[numId]) continue;

      // Check if this tag is in the keep list
      const tagName = getTagName(ifdName, numId);
      if (tagName && keepSet.has(tagName)) continue;

      // Remove it
      delete ifdData[tagId];
    }
  }

  // Re-embed the filtered EXIF
  const exifBytes = piexif.dump(exifObj);
  const newDataUrl = piexif.insert(exifBytes, dataUrl);

  // Convert back to Blob
  return dataUrlToBlob(newDataUrl);
}

/* ── Helpers ─────────────────────────────────── */

function arrayBufferToDataUrl(buffer, mimeType) {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return `data:${mimeType};base64,${btoa(binary)}`;
}

function dataUrlToBlob(dataUrl) {
  const [header, base64] = dataUrl.split(',');
  const mime = header.match(/:(.*?);/)[1];
  const binary = atob(base64);
  const array = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    array[i] = binary.charCodeAt(i);
  }
  return new Blob([array], { type: mime });
}

function buildTagMap() {
  const map = {};
  for (const [ifdName, tags] of Object.entries(piexif.TAGS)) {
    for (const [tagId, tagInfo] of Object.entries(tags)) {
      const name = typeof tagInfo === 'object' ? tagInfo.name : tagInfo;
      if (name) {
        map[name] = { ifd: ifdName, tagId: parseInt(tagId, 10) };
      }
    }
  }
  return map;
}

function getTagName(ifdName, tagId) {
  const ifdKey = ifdName === '0th' ? 'ImageIFD' :
                 ifdName === 'Exif' ? 'ExifIFD' :
                 ifdName === 'GPS' ? 'GPSIFD' :
                 ifdName === '1st' ? 'ImageIFD' :
                 ifdName === 'Interop' ? 'InteropIFD' : null;

  if (!ifdKey || !piexif.TAGS[ifdKey]) return null;
  const tagInfo = piexif.TAGS[ifdKey][tagId];
  if (!tagInfo) return null;
  return typeof tagInfo === 'object' ? tagInfo.name : tagInfo;
}
