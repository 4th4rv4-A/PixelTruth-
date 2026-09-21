/**
 * Format bytes into a human-readable string.
 * @param {number} bytes
 * @returns {string}
 */
export function formatSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

/**
 * Calculate size difference and percentage.
 * @param {number} original
 * @param {number} cleaned
 * @returns {{ diff: number, pct: string, isSaved: boolean, isIncreased: boolean }}
 */
export function calculateSizeChange(original, cleaned) {
  const diff = original - cleaned;
  const pct = original > 0 ? ((Math.abs(diff) / original) * 100).toFixed(1) : '0.0';
  return {
    diff,
    pct,
    isSaved: diff > 0,
    isIncreased: diff < 0,
  };
}

/**
 * Format a size comparison result.
 * @param {number} original
 * @param {number} cleaned
 * @returns {string}
 */
export function formatSizeComparison(original, cleaned) {
  const { diff, pct, isSaved, isIncreased } = calculateSizeChange(original, cleaned);

  if (isSaved) {
    return `Saved ${formatSize(diff)} (${pct}%)`;
  } else if (isIncreased) {
    return `Increased by ${formatSize(-diff)} (${pct}%)`;
  }
  return 'Same size';
}
