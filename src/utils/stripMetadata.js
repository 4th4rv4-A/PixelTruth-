import { imagePool } from '../workers/instances';

function getOutputMime(file) {
  if (file.type === 'image/png') return 'image/png';
  if (file.type === 'image/webp') return 'image/webp';
  return 'image/jpeg';
}

/**
 * Full strip — offloads image sanitization to Web Worker.
 * @param {File} file
 * @param {boolean} [fullSanitize=false] If true, strips ICC profile too
 * @param {Function} [onProgress]
 * @param {AbortSignal} [signal]
 * @returns {Promise<Blob>}
 */
export async function stripFull(file, fullSanitize = false, onProgress, signal) {
  const buffer = await file.arrayBuffer();
  
  const result = await imagePool.dispatch('STRIP_METADATA', {
    buffer,
    mime: file.type,
    name: file.name,
    keepTags: [], // Empty means full strip
    fullSanitize,
  }, {
    transfer: [buffer],
    onProgress,
    signal
  });

  const mimeType = getOutputMime(file);
  return new Blob([result.buffer], { type: mimeType });
}

/**
 * Selective strip — offloads image sanitization to Web Worker.
 * @param {File} file
 * @param {string[]} keepTags 
 * @param {boolean} [fullSanitize=false]
 * @param {Function} [onProgress]
 * @param {AbortSignal} [signal]
 * @returns {Promise<Blob>}
 */
export async function stripSelective(file, keepTags = [], fullSanitize = false, onProgress, signal) {
  const buffer = await file.arrayBuffer();
  
  const result = await imagePool.dispatch('STRIP_METADATA', {
    buffer,
    mime: file.type,
    name: file.name,
    keepTags,
    fullSanitize,
  }, {
    transfer: [buffer],
    onProgress,
    signal
  });

  const mimeType = getOutputMime(file);
  return new Blob([result.buffer], { type: mimeType });
}

/**
 * Unified image cleaning function that routes between selective or full metadata stripping.
 * @param {File} file
 * @param {Object} [options]
 * @param {string[]} [options.keepTags=[]]
 * @param {boolean} [options.fullSanitize=false]
 * @param {Function} [options.onProgress]
 * @param {AbortSignal} [options.signal]
 * @returns {Promise<Blob>}
 */
export async function cleanImageFile(file, options = {}) {
  const { keepTags = [], fullSanitize = false, onProgress, signal } = options;
  const isJpeg = file.type === 'image/jpeg';
  if (isJpeg && keepTags.length > 0) {
    return stripSelective(file, keepTags, fullSanitize, onProgress, signal);
  }
  return stripFull(file, fullSanitize, onProgress, signal);
}

