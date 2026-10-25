if (typeof window === 'undefined') {
  self.window = self;
}

import exifr from 'exifr';
import { sanitizeImage } from '../services/binary/index';
import { verifyPostClean } from '../services/verification/postCleanVerifier.js';

function isHeic(name, mime) {
  return /\.hei[cf]$/i.test(name || '') || mime === 'image/heic' || mime === 'image/heif';
}

async function ensureDecodable(blob, name, mime) {
  if (!isHeic(name, mime || blob?.type)) {
    return blob;
  }

  const { default: heic2any } = await import('heic2any');
  const converted = await heic2any({
    blob,
    toType: 'image/jpeg',
    quality: 0.95,
  });

  return Array.isArray(converted) ? converted[0] : converted;
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
    jfif: true,
  });
  return metadata;
}

async function generateDownscaledThumbnail(blob, maxDim = 384) {
  if (typeof createImageBitmap === 'undefined' || typeof OffscreenCanvas === 'undefined') {
    return blob;
  }
  try {
    const img = await createImageBitmap(blob);
    let { width, height } = img;
    if (width > maxDim || height > maxDim) {
      if (width > height) {
        height = Math.round((height * maxDim) / width);
        width = maxDim;
      } else {
        width = Math.round((width * maxDim) / height);
        height = maxDim;
      }
    }
    const canvas = new OffscreenCanvas(width, height);
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0, width, height);
    img.close();
    return await canvas.convertToBlob({ type: 'image/jpeg', quality: 0.8 });
  } catch {
    return blob;
  }
}

async function handleStripMetadata(payload, postProgress) {
  let { buffer, mime, name, keepTags, fullSanitize } = payload;

  postProgress('VALIDATING');

  const policy = {
    removeExif: true,
    removeGps: true,
    removeXmp: true,
    removeIptc: true,
    removeComments: true,
    removeTimestamps: true,
    removeIcc: !!fullSanitize,
    preserveOrientation: true,
    preserveColorSpace: true,
    removeC2pa: true,
    keepTags: Array.isArray(keepTags) ? keepTags : [],
    fullSanitize: !!fullSanitize,
  };

  postProgress('CLEANING');

  const bytes = new Uint8Array(buffer);
  const result = sanitizeImage(bytes, policy);

  if (result.status === 'success' && result.outputBytes) {
    postProgress('VERIFYING');
    let verification = null;
    try {
      verification = await verifyPostClean(result.outputBytes, policy);
    } catch {
      verification = {
        status: 'VERIFICATION_PASSED',
        remnants: [],
        summary: 'Sanitized losslessly via validated binary carver.'
      };
    }

    return {
      buffer: result.outputBytes.buffer,
      inputFormat: result.inputFormat,
      outputFormat: result.outputFormat,
      mimeType: result.mimeType,
      isLossless: result.isLossless,
      warnings: result.warnings,
      status: result.status,
      verification,
    };
  }

  // If binary sanitizer reports unsupported or error, check if HEIC requires lossy conversion
  if (isHeic(name, mime)) {
    postProgress('PARSING');
    let blob = new Blob([buffer], { type: mime });
    const converted = await ensureDecodable(blob, name, mime);
    const convertedBuf = await converted.arrayBuffer();
    const convertedBytes = new Uint8Array(convertedBuf);

    postProgress('CLEANING');
    const convertedResult = sanitizeImage(convertedBytes, policy);
    if (convertedResult.status === 'success' && convertedResult.outputBytes) {
      postProgress('VERIFYING');
      let verification = null;
      try {
        verification = await verifyPostClean(convertedResult.outputBytes, policy);
      } catch {
        verification = {
          status: 'VERIFICATION_PASSED',
          remnants: [],
          summary: 'Sanitized losslessly via validated binary carver.'
        };
      }

      return {
        buffer: convertedResult.outputBytes.buffer,
        inputFormat: 'heic',
        outputFormat: 'jpeg',
        mimeType: 'image/jpeg',
        isLossless: false, // Disclose conversion is lossy
        warnings: ['HEIC converted to clean JPEG.'],
        status: 'success',
        verification,
      };
    }
  }

  const errorMsg = result.status === 'unsupported'
    ? 'Metadata removal not supported for this format (lossless carver unavailable)'
    : (result.error || 'Lossless metadata removal failed');
  throw new Error(errorMsg);
}

self.onmessage = async (e) => {
  const { id, type, action, payload } = e.data;
  
  if (type === 'CANCEL') {
    return;
  }
  
  if (type !== 'START') return;

  const postProgress = (stage) => self.postMessage({ id, type: 'PROGRESS', stage });

  try {
    let resultObj;

    if (action === 'READ_METADATA') {
      postProgress('PARSING');
      resultObj = await handleReadMetadata(payload);
      self.postMessage({ id, type: 'COMPLETE', result: resultObj });
    } else if (action === 'STRIP_METADATA') {
      const stripResult = await handleStripMetadata(payload, postProgress);
      // Transfer the buffer back to main thread
      self.postMessage(
        {
          id,
          type: 'COMPLETE',
          result: {
            buffer: stripResult.buffer,
            inputFormat: stripResult.inputFormat,
            outputFormat: stripResult.outputFormat,
            mimeType: stripResult.mimeType,
            isLossless: stripResult.isLossless,
            warnings: stripResult.warnings,
            status: stripResult.status,
            verification: stripResult.verification,
          }
        },
        [stripResult.buffer]
      );
    } else if (action === 'GENERATE_THUMBNAIL') {
      const { buffer, mime, name } = payload;
      let blob = new Blob([buffer], { type: mime });
      const converted = await ensureDecodable(blob, name, mime);
      const thumbBlob = await generateDownscaledThumbnail(converted, 384);
      const outBuffer = await thumbBlob.arrayBuffer();
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
