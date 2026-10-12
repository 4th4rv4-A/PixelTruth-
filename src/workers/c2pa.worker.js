import { createC2pa, Reader } from '@contentauth/c2pa-web';
import wasmSrc from '@contentauth/c2pa-web/resources/c2pa.wasm?url';
import workerSrc from '@contentauth/c2pa-web/c2pa_worker?url';

let c2paPromise = null;

async function getC2pa() {
  if (!c2paPromise) {
    c2paPromise = createC2pa({ wasmSrc, workerSrc });
  }
  return await c2paPromise;
}

const MAX_STR = 400;
function bound(v) {
  if (v === null || v === undefined) return null;
  const s = typeof v === 'string' ? v : String(v);
  return s.length > MAX_STR ? s.slice(0, MAX_STR) + '…' : s;
}

/**
 * Reads the C2PA Content Credentials manifest and returns raw, display-ready
 * fields. Cryptographic validation is performed by the WASM runtime; the
 * resulting validationStatus entries are passed through verbatim (bounded).
 */
async function handleReadC2pa(payload) {
  const { file } = payload;
  const c2pa = await getC2pa();

  let reader = null;
  try {
    reader = await Reader.fromBlob(c2pa, file.type, file);
    const store = await reader.manifestStore();

    if (!store || !store.activeManifest) {
      return { present: false };
    }

    const m = store.activeManifest;
    const actions = [];
    if (m.assertions && m.assertions.data) {
      for (const assertion of m.assertions.data) {
        if (assertion.label === 'c2pa.actions' && assertion.data && Array.isArray(assertion.data.actions)) {
          for (const a of assertion.data.actions) {
            actions.push({
              action: bound(a.action),
              description: bound(a.description),
              digitalSourceType: bound(a.digitalSourceType),
            });
          }
        }
      }
    }

    const validation = (store.validationStatus || []).map((v) => ({
      code: bound(v.code),
      ok: v.ok ?? v.success ?? null,
    }));

    return {
      present: true,
      claimGenerator: bound(m.claimGenerator),
      instanceId: bound(m.instanceId ?? m.claim?.instance_id),
      signatureAlg: bound(m.signatureInfo?.alg),
      issuer: bound(m.signatureInfo?.issuer),
      time: bound(m.signatureInfo?.time),
      actions,
      validation,
    };
  } finally {
    if (reader && typeof reader.free === 'function') {
      await reader.free();
    }
  }
}

self.onmessage = async (e) => {
  const { id, type, action, payload } = e.data;
  if (type === 'CANCEL') return;
  if (type !== 'START') return;

  try {
    if (action === 'READ_C2PA') {
      const result = await handleReadC2pa(payload);
      self.postMessage({ id, type: 'COMPLETE', result });
    } else {
      throw new Error(`Unknown action: ${action}`);
    }
  } catch (error) {
    self.postMessage({ id, type: 'ERROR', error: error.message || 'Worker error' });
  }
};
