import { c2paPool } from '../workers/instances';

/**
 * Dispatches the C2PA read to the WASM-backed worker.
 * Returns the raw manifest object, or null when reading fails (no credential,
 * unsupported, decode error). Cancellation/timeout are re-thrown.
 * @param {File} file
 * @param {AbortSignal} [signal]
 * @returns {Promise<Object|null>}
 */
export async function readC2paManifest(file, signal) {
  try {
    return await c2paPool.dispatch('READ_C2PA', { file }, { signal });
  } catch (err) {
    if (err && (err.message === 'CANCELLED' || err.message === 'TIMEOUT')) throw err;
    return null;
  }
}

/**
 * Flattens a raw C2PA manifest (from c2pa.worker READ_C2PA) into
 * [tag, value] rows for the metadata table, mirroring exifremover.com.
 * @param {Object|null} manifest
 * @returns {Array<[string, string]>}
 */
export function flattenC2paRows(manifest) {
  if (!manifest || !manifest.present) return [];
  const rows = [];
  if (manifest.claimGenerator) rows.push(['Claim Generator', manifest.claimGenerator]);
  if (manifest.instanceId) rows.push(['Instance ID', manifest.instanceId]);
  if (manifest.signatureAlg) rows.push(['Signature Alg', manifest.signatureAlg]);
  if (manifest.issuer) rows.push(['Issuer', manifest.issuer]);
  if (manifest.time) rows.push(['Signed At', manifest.time]);
  (manifest.actions || []).forEach((a, i) => {
    const parts = [a.action, a.description, a.digitalSourceType].filter(Boolean);
    if (parts.length) rows.push([`Action ${i + 1}`, parts.join(' — ')]);
  });
  (manifest.validation || []).forEach((v) => {
    if (!v.code) return;
    const mark = v.ok === true ? ' ✓' : v.ok === false ? ' ✗' : '';
    rows.push(['Validation', `${v.code}${mark}`]);
  });
  return rows;
}
