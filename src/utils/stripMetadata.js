import { imagePool } from '../workers/instances';

function getOutputMime(file) {
  if (file.type === 'image/png') return 'image/png';
  if (file.type === 'image/webp') return 'image/webp';
  return 'image/jpeg';
}

/**
 * Full strip — offloads image sanitization to Web Worker.
 * @param {File} file
 * @param {Function} [onProgress]
 * @param {AbortSignal} [signal]
 * @returns {Promise<Blob>}
 */
export async function stripFull(file, onProgress, signal) {
  const buffer = await file.arrayBuffer();
  
  const result = await imagePool.dispatch('STRIP_METADATA', {
    buffer,
    mime: file.type,
    name: file.name,
    keepTags: [], // Empty means full strip
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
 * @param {Function} [onProgress]
 * @param {AbortSignal} [signal]
 * @returns {Promise<Blob>}
 */
export async function stripSelective(file, keepTags = [], onProgress, signal) {
  const buffer = await file.arrayBuffer();
  
  const result = await imagePool.dispatch('STRIP_METADATA', {
    buffer,
    mime: file.type,
    name: file.name,
    keepTags,
  }, {
    transfer: [buffer],
    onProgress,
    signal
  });

  const mimeType = getOutputMime(file);
  return new Blob([result.buffer], { type: mimeType });
}
