import JSZip from 'jszip';
import { saveAs } from 'file-saver';

/**
 * Bundle cleaned files into a ZIP and trigger download.
 * @param {{ name: string, blob: Blob }[]} cleanedFiles
 */
export async function downloadAsZip(cleanedFiles) {
  const zip = new JSZip();
  cleanedFiles.forEach(({ name, blob }) => {
    zip.file(name, blob);
  });
  const content = await zip.generateAsync({ type: 'blob' });
  saveAs(content, 'pixeltruth-cleaned.zip');
}

/**
 * Download a single cleaned file.
 * @param {string} name
 * @param {Blob} blob
 */
export function downloadSingle(name, blob) {
  saveAs(blob, `cleaned-${name}`);
}
