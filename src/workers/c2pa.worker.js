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
    const manifestStore = reader.manifestStore;

    if (!manifestStore || !manifestStore.activeManifest) {
      return {
        provenance: PROVENANCE_STATE.NO_PROVENANCE,
        aiSignal: AI_SIGNAL_STATE.NO_SIGNAL,
        raw: null,
      };
    }

    postProgress('VERIFYING');
    const activeManifest = manifestStore.activeManifest;
    
    // Evaluate Validation State
    let validationStatus = manifestStore.validationStatus || [];
    let provenanceState = PROVENANCE_STATE.PRESENT_UNVALIDATED;
    
    // Basic heuristics: empty validation array usually implies valid in c2pa-web, 
    // or we check the specific code. 
    // In @contentauth/c2pa-web, activeManifest.isTrustLoaded might exist, 
    // but typically if validationStatus is empty, it's structurally valid.
    if (validationStatus.length === 0) {
       // Ideally we'd check against a trust list, but structurally it's valid
       provenanceState = PROVENANCE_STATE.VALID; 
    }

    // Extract assertions for AI inference vs Cryptographic provenance
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

        // Check for AI action in c2pa.actions
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
    
    // Check digital source type on the creation action/ingredient
    // (If the creator declared it as algorithmic media)
    
    // Check generator (Software string) - This is an inference, NOT provenance!
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

    // Determine final states
    if (hasCryptographicAiAction && (provenanceState === PROVENANCE_STATE.VALID || provenanceState === PROVENANCE_STATE.TRUSTED)) {
      provenanceState = PROVENANCE_STATE.SIGNED_AI;
    }

    let aiSignal = AI_SIGNAL_STATE.NO_SIGNAL;
    if (hasCryptographicAiAction) {
       aiSignal = AI_SIGNAL_STATE.METADATA_SIGNAL; 
    } else if (hasAiSoftwareString) {
       aiSignal = AI_SIGNAL_STATE.SOFTWARE_SIGNAL;
    }

    // Build normalized result
    return {
      provenance: provenanceState,
      aiSignal: aiSignal,
      generator: generatorString,
      issuer: activeManifest.signatureInfo?.issuer || 'Unknown Signer',
      time: activeManifest.signatureInfo?.time,
      validationIssues: validationStatus,
      ingredientsCount: activeManifest.ingredients?.length || 0,
      assertions: serializedAssertions,
      raw: generatorString // A tiny summary for UI
    };
  } finally {
    if (reader && typeof reader.dispose === 'function') {
      reader.dispose();
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
