import piexif from 'piexifjs';
import heic2any from 'heic2any';
import exifr from 'exifr';
import { sanitizeImage } from '../services/binary/index';

// Polyfill/Helper for canvas in worker
async function drawToOffscreenCanvas(blob, mimeType) {
  let img;
  try {
    img = await createImageBitmap(blob);
  } catch {
    throw new Error(`Failed to decode image: the image may be corrupt or unsupported.`);
  }

  if (typeof OffscreenCanvas === 'undefined') {
    throw new Error('UNSUPPORTED_OPERATION');
  }

  const canvas = new OffscreenCanvas(img.width, img.height);
  const ctx = canvas.getContext('2d');
  ctx.drawImage(img, 0, 0);
  img.close();

  const quality = mimeType === 'image/png' ? undefined : 0.95;
  const outBlob = await canvas.convertToBlob({ type: mimeType, quality });

  // Explicit fallback if WebP was requested but browser failed to output WebP
  if (mimeType === 'image/webp' && outBlob.type !== 'image/webp') {
    return canvas.convertToBlob({ type: 'image/jpeg', quality: 0.95 });
  }

  return outBlob;
}

function isHeicName(name) {
  return /\.hei[cf]$/i.test(name);
}

async function ensureDecodable(blob, name) {
  if (!isHeicName(name)) {
    return blob;
  }

  const converted = await heic2any({
    blob,
    toType: 'image/jpeg',
    quality: 0.95,
  });

  return Array.isArray(converted) ? converted[0] : converted;
}

function getOutputMime(mime) {
  if (mime === 'image/png') return 'image/png';
  if (mime === 'image/webp') return 'image/webp';
  return 'image/jpeg';
}

function arrayBufferToDataUrl(buffer, mimeType) {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  // Avoid Maximum call stack size exceeded for large arrays
  const chunkSize = 8192;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunkSize));
  }
  return `data:${mimeType};base64,${btoa(binary)}`;
}

function dataUrlToArrayBuffer(dataUrl) {
  const base64 = dataUrl.split(',')[1];
  const binary = atob(base64);
  const array = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    array[i] = binary.charCodeAt(i);
  }
  return array.buffer;
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

async function handleReadMetadata(payload) {
  const { file } = payload;
  const metadata = await exifr.parse(file, {
    tiff: true,
    exif: true,
    gps: true,
    xmp: true,
    icc: true,
    iptc: true,
  });
  return metadata;
}

async function handleStripMetadata(payload, postProgress) {
  let { buffer, mime, name, keepTags, preserveC2pa } = payload;

  postProgress('VALIDATING');

  const isSelective = mime === 'image/jpeg' && keepTags && keepTags.length > 0;

  if (!isSelective) {
    // Attempt lossless full strip
    postProgress('CLEANING');
    try {
      const bytes = new Uint8Array(buffer);
      const policy = {
        removeExif: true, removeGps: true, removeXmp: true,
        removeIptc: true, removeComments: true, removeIcc: preserveC2pa ? false : true,
        removeC2pa: !preserveC2pa, preserveC2pa: !!preserveC2pa,
      };
      
      const result = sanitizeImage(bytes, policy);
      if (result.status === 'success' && result.outputBlob) {
        return await result.outputBlob.arrayBuffer();
      }
    } catch (err) {
      console.warn('Lossless strip failed in worker, falling back.', err);
    }
  }

  // Fallback or Selective
  postProgress('PARSING');
  let blob = new Blob([buffer], { type: mime });
  blob = await ensureDecodable(blob, name);
  const outMime = getOutputMime(blob.type || mime);

  if (isSelective) {
    postProgress('CLEANING');
    const arrayBuffer = await blob.arrayBuffer();
    const dataUrl = arrayBufferToDataUrl(arrayBuffer, 'image/jpeg');

    let exifObj;
    try {
      exifObj = piexif.load(dataUrl);
      
      const alwaysKeepIfd0 = { 0x0112: true }; 
      const alwaysKeepExif = { 0xA001: true };  
      const keepSet = new Set(keepTags);

      for (const ifdName of ['0th', 'Exif', 'GPS', '1st', 'Interop']) {
        const ifdData = exifObj[ifdName];
        if (!ifdData) continue;

        for (const tagId of Object.keys(ifdData)) {
          const numId = parseInt(tagId, 10);
          if (ifdName === '0th' && alwaysKeepIfd0[numId]) continue;
          if (ifdName === 'Exif' && alwaysKeepExif[numId]) continue;

          const tagName = getTagName(ifdName, numId);
          if (tagName && keepSet.has(tagName)) continue;

          delete ifdData[tagId];
        }
      }

      const exifBytes = piexif.dump(exifObj);
      const newDataUrl = piexif.insert(exifBytes, dataUrl);
      return dataUrlToArrayBuffer(newDataUrl);
    } catch (e) {
      console.warn('Selective strip failed in piexif, falling back to full strip via canvas', e);
    }
  }

  postProgress('ENCODING');
  const cleanedBlob = await drawToOffscreenCanvas(blob, outMime);
  return await cleanedBlob.arrayBuffer();
}

self.onmessage = async (e) => {
  const { id, type, action, payload } = e.data;
  
  if (type === 'CANCEL') {
    // We can't interrupt an already running async block easily without polling,
    // but the pool manager will reject the promise and optionally terminate us.
    return;
  }
  
  if (type !== 'START') return;

  const postProgress = (stage) => self.postMessage({ id, type: 'PROGRESS', stage });

  try {
    let resultBuffer;
    let resultObj;

    if (action === 'READ_METADATA') {
      postProgress('PARSING');
      resultObj = await handleReadMetadata(payload);
      self.postMessage({ id, type: 'COMPLETE', result: resultObj });
    } else if (action === 'STRIP_METADATA') {
      resultBuffer = await handleStripMetadata(payload, postProgress);
      // Transfer the buffer back to main thread
      self.postMessage(
        { id, type: 'COMPLETE', result: { buffer: resultBuffer } },
        [resultBuffer]
      );
    } else if (action === 'GENERATE_THUMBNAIL') {
      const { buffer, mime, name } = payload;
      let blob = new Blob([buffer], { type: mime });
      const converted = await ensureDecodable(blob, name); // ensures heic is converted to jpeg
      
      // If we want it truly low quality, we can downscale it here, but ensureDecodable uses 0.95.
      // For now, this moves the heavy lifting off the main thread.
      const outBuffer = await converted.arrayBuffer();
      self.postMessage(
        { id, type: 'COMPLETE', result: { buffer: outBuffer } },
        [outBuffer]
      );
    } else {
      throw new Error(`Unknown action: ${action}`);
    }
  } catch (error) {
    self.postMessage({ id, type: 'ERROR', error: error.message || 'Worker error' });
  }
};
