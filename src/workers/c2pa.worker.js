import { createC2pa, Reader } from '@contentauth/c2pa-web';
import wasmSrc from '@contentauth/c2pa-web/resources/c2pa.wasm?url';
import workerSrc from '@contentauth/c2pa-web/c2pa_worker?url';

import { PROVENANCE_STATE, AI_SIGNAL_STATE } from '../utils/verdicts';

let c2paPromise = null;

async function getC2pa() {
  if (!c2paPromise) {
    c2paPromise = createC2pa({
      wasmSrc,
      workerSrc,
    });
  }
  return await c2paPromise;
}

async function handleDetectAI(payload, postProgress) {
  const { file } = payload;
  const mime = file.type;

  postProgress('INITIALIZING_WASM');
  const c2pa = await getC2pa();

  let reader = null;
  try {
    postProgress('INSPECTING');
    reader = await Reader.fromBlob(c2pa, mime, file);
    const manifestStore = await reader.manifestStore();

    if (!manifestStore || !manifestStore.activeManifest) {
      return {
        provenance: PROVENANCE_STATE.NO_CREDENTIAL,
        aiSignal: AI_SIGNAL_STATE.NO_SIGNAL,
        raw: null,
      };
    }

    postProgress('VERIFYING');
    const activeManifest = manifestStore.activeManifest;
    
    let validationStatus = manifestStore.validationStatus || [];
    let provenanceState = PROVENANCE_STATE.CREDENTIAL_PRESENT_INVALID;
    
    if (validationStatus.length === 0) {
       provenanceState = PROVENANCE_STATE.CREDENTIAL_VALID_UNTRUSTED; 
    }

    let hasCryptographicAiAction = false;
    let hasAiSoftwareString = false;
    let generatorString = 'Unknown';

    const serializedAssertions = [];

    if (activeManifest.assertions && activeManifest.assertions.data) {
      for (const assertion of activeManifest.assertions.data) {
        let decodedData = assertion.data;
        try {
          if (decodedData instanceof Uint8Array) {
            decodedData = new TextDecoder().decode(decodedData);
          }
        } catch {
          decodedData = '<binary>';
        }

        serializedAssertions.push({
          label: assertion.label,
          data: decodedData,
        });

        if (assertion.label === 'c2pa.actions' && decodedData?.actions) {
          for (const action of decodedData.actions) {
            const act = (action.action || '').toLowerCase();
            const digitalSourceType = (action.digitalSourceType || '').toLowerCase();
            if (
              act.includes('generated') || 
              act.includes('ai') || 
              act.includes('synthetic') ||
              digitalSourceType.includes('trainedalgorithmicmedia')
            ) {
              hasCryptographicAiAction = true;
            }
          }
        }
      }
    }
    
    try {
      const claimGenerator = activeManifest.claimGenerator;
      if (typeof claimGenerator === 'string') {
        generatorString = claimGenerator.split('(')[0].trim();
        const lowerGen = claimGenerator.toLowerCase();
        if (lowerGen.includes('ai') || lowerGen.includes('midjourney') || lowerGen.includes('dall-e') || lowerGen.includes('firefly') || lowerGen.includes('stable diffusion')) {
          hasAiSoftwareString = true;
        }
      }
    } catch {
      // Ignore
    }

    let aiSignal = AI_SIGNAL_STATE.NO_SIGNAL;
    if (hasCryptographicAiAction) {
       aiSignal = AI_SIGNAL_STATE.METADATA_SIGNAL; 
    } else if (hasAiSoftwareString) {
       aiSignal = AI_SIGNAL_STATE.SOFTWARE_INDICATOR;
    }

    return {
      provenance: provenanceState,
      hasCryptographicAiAction,
      aiSignal: aiSignal,
      generator: generatorString,
      issuer: activeManifest.signatureInfo?.issuer || 'Unknown Signer',
      time: activeManifest.signatureInfo?.time,
      validationIssues: validationStatus,
      ingredientsCount: activeManifest.ingredients?.length || 0,
      assertions: serializedAssertions,
      raw: generatorString
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

  const postProgress = (stage) => self.postMessage({ id, type: 'PROGRESS', stage });

  try {
    if (action === 'DETECT_AI') {
      const result = await handleDetectAI(payload, postProgress);
      self.postMessage({ id, type: 'COMPLETE', result });
    } else {
      throw new Error(`Unknown action: ${action}`);
    }
  } catch (error) {
    self.postMessage({ id, type: 'ERROR', error: error.message || 'Worker error' });
  }
};
