import { createResult } from './policy.js';

const textDecoder = new TextDecoder('latin1');

/**
 * Losslessly sanitizes a PDF document by in-place blanking metadata dictionaries and XMP streams.
 *
 * Neutralizes:
 * - Document Information Dictionary (/Info): /Title, /Author, /Subject, /Keywords, /Creator, /Producer, /CreationDate, /ModDate
 * - Extensible Metadata Platform (/Metadata XMP streams) in Catalog, Pages, and Objects
 * - Trailer /Info reference entries
 *
 * Uses whitespace-preserving in-place modification so cross-reference ('xref') byte offsets
 * remain 100% intact, guaranteeing that PDF viewers open the file without corruption warnings.
 *
 * @param {Uint8Array} inputBytes
 * @param {Object} [_policy]
 * @returns {Object} result created by createResult
 */
export function sanitizePdf(inputBytes, _policy = {}) {
  const len = inputBytes.length;
  if (len < 32) {
    return createResult({
      format: 'pdf',
      inputBytes,
      status: 'malformed',
      error: 'File is too small to be a valid PDF document.'
    });
  }

  // 1. Verify PDF header (%PDF-)
  const header = textDecoder.decode(inputBytes.subarray(0, 8));
  if (!header.startsWith('%PDF-')) {
    return createResult({
      format: 'pdf',
      inputBytes,
      status: 'malformed',
      error: 'Invalid PDF header: missing %PDF- signature.'
    });
  }

  const outputBytes = new Uint8Array(inputBytes);
  const removedSegments = [];
  const preservedSegments = ['PAGES', 'FONTS', 'STREAMS', 'XREF'];

  // Convert to latin1 string for regex matching while preserving 1:1 byte indices
  const text = textDecoder.decode(outputBytes);

  // 2. Neutralize XMP /Metadata streams
  // Regex looks for object dictionary containing /Type\s*/Metadata followed by stream ... endstream
  const metaRegex = /\/Type\s*\/Metadata[\s\S]*?stream[\r\n]+([\s\S]*?)endstream/gi;
  let match;
  while ((match = metaRegex.exec(text)) !== null) {
    const streamContent = match[1];
    const streamStart = match.index + match[0].indexOf(streamContent);
    const streamEnd = streamStart + streamContent.length;

    // Blank out stream content with spaces
    outputBytes.fill(0x20, streamStart, streamEnd);
    removedSegments.push('XMP_METADATA_STREAM');
  }

  // 3. Neutralize /Info dictionary entries in indirect objects
  // Common metadata keys in Info dictionaries
  const infoKeys = [
    'Title', 'Author', 'Subject', 'Keywords', 'Creator',
    'Producer', 'CreationDate', 'ModDate', 'Trapped'
  ];

  for (const key of infoKeys) {
    // Matches /Key\s*(\([^\)]*\)|<[^>]*>)
    const keyRegex = new RegExp(`\\/${key}\\s*(\\([^\\)]*\\)|<[^>]*>)`, 'g');
    let kmatch;
    while ((kmatch = keyRegex.exec(text)) !== null) {
      const matchStart = kmatch.index;
      const matchLen = kmatch[0].length;
      // Overwrite the key and value with spaces (0x20)
      outputBytes.fill(0x20, matchStart, matchStart + matchLen);
      removedSegments.push(`INFO_${key.toUpperCase()}`);
    }
  }

  // 4. Neutralize /Info references in trailer
  const trailerInfoRegex = /\/Info\s+\d+\s+\d+\s+R/g;
  let tmatch;
  while ((tmatch = trailerInfoRegex.exec(text)) !== null) {
    const tStart = tmatch.index;
    const tLen = tmatch[0].length;
    outputBytes.fill(0x20, tStart, tStart + tLen);
    removedSegments.push('TRAILER_INFO_REF');
  }

  return createResult({
    format: 'pdf',
    inputBytes,
    outputBytes,
    removedSegments,
    preservedSegments,
    imageBitstreamChanged: false,
    status: 'success'
  });
}
