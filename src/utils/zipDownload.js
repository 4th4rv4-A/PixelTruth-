import JSZip from 'jszip';
import { saveAs } from 'file-saver';

/**
 * Deduplicate filenames for ZIP archives.
 * @param {string} name - desired filename
 * @param {Set<string>} usedNames - set of already-used names (mutated)
 * @returns {string} unique filename
 */
export function deduplicateName(name, usedNames) {
  if (!usedNames.has(name)) {
    usedNames.add(name);
    return name;
  }

  const dotIndex = name.lastIndexOf('.');
  const base = dotIndex !== -1 ? name.slice(0, dotIndex) : name;
  const ext = dotIndex !== -1 ? name.slice(dotIndex) : '';

  let counter = 2;
  let candidate = `${base}-${counter}${ext}`;
  while (usedNames.has(candidate)) {
    counter++;
    candidate = `${base}-${counter}${ext}`;
  }

  usedNames.add(candidate);
  return candidate;
}

/**
 * Bundle cleaned files into a ZIP and trigger download.
 * Handles filename collisions by appending -2, -3, etc.
 * @param {{ name: string, blob: Blob }[]} cleanedFiles
 */
export async function downloadAsZip(cleanedFiles) {
  const zip = new JSZip();
  const usedNames = new Set();

  cleanedFiles.forEach(({ name, blob }) => {
    const uniqueName = deduplicateName(name, usedNames);
    zip.file(uniqueName, blob);
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
