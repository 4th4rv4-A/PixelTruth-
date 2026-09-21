import piexif from 'piexifjs';
import heic2any from 'heic2any';
import { isHeic } from './filenameUtils';

/**
 * Convert HEIC/HEIF files to JPEG for processing.
 * Non-HEIC files are returned unchanged.
 * @param {File} file
 * @returns {Promise<File>}
 */
async function ensureDecodable(file) {
  if (!isHeic(file)) {
    return file;
  }

  const converted = await heic2any({
    blob: file,
    toType: 'image/jpeg',
    quality: 0.95,
  });

  const blob = Array.isArray(converted) ? converted[0] : converted;

  return new File(
    [blob],
    file.name.replace(/\.hei[cf]$/i, '.jpg'),
    { type: 'image/jpeg' }
  );
}

/**
 * Determine the correct output MIME type for a file.
 * Preserves PNG and WebP; converts everything else to JPEG.
 * @param {File} file
 * @returns {string}
 */
function getOutputMime(file) {
  if (file.type === 'image/png') return 'image/png';
  if (file.type === 'image/webp') return 'image/webp';
  return 'image/jpeg';
}

/**
 * Full strip — draw image onto canvas, re-export as clean blob.
 * Works for all formats. Strips ALL metadata.
 * HEIC/HEIF files are converted to JPEG before processing.
 * WebP and PNG formats are preserved; others output as JPEG.
 * @param {File} file
 * @returns {Promise<Blob>}
 */
export async function stripFull(file) {
  // Convert HEIC/HEIF to JPEG before processing
  file = await ensureDecodable(file);

  let img;
  try {
    img = await createImageBitmap(file);
  } catch {
    throw new Error(`Failed to decode "${file.name}": the image may be corrupt or in an unsupported format.`);
  }

  const canvas = document.createElement('canvas');
  canvas.width = img.width;
  canvas.height = img.height;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(img, 0, 0);
  img.close();

  const mimeType = getOutputMime(file);
  const quality = mimeType === 'image/png' ? undefined : 0.95;

  const blob = await new Promise((resolve, reject) => {
    canvas.toBlob((b) => {
      if (b) resolve(b);
      else reject(new Error('Failed to encode the cleaned image.'));
    }, mimeType, quality);
  });

  // WebP verification: If WebP was requested but browser produced non-WebP (e.g. image/png),
  // explicitly convert to JPEG so extension and byte format are strictly aligned
  if (mimeType === 'image/webp' && blob.type !== 'image/webp') {
    const fallbackJpeg = await new Promise((resolve, reject) => {
      canvas.toBlob((b) => {
        if (b) resolve(b);
        else reject(new Error('Failed to encode image to fallback JPEG.'));
      }, 'image/jpeg', 0.95);
    });
    return fallbackJpeg;
  }

  return blob;
}

/**
 * Selective strip — JPEG only. Remove unchecked EXIF tags, keep checked ones.
 * Orientation and ColorSpace are always preserved.
 * HEIC/HEIF files are converted to JPEG before processing.
 * @param {File} file - must be JPEG (or HEIC, which will be converted)
 * @param {string[]} keepTags - tag names to preserve
 * @returns {Promise<Blob>}
 */
export async function stripSelective(file, keepTags = []) {
  // Convert HEIC/HEIF to JPEG before processing
  file = await ensureDecodable(file);

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
