import { ModelAdapter } from '../services/ai/ModelAdapter';

const adapter = new ModelAdapter();

// We'll point to a hypothetical model path.
// This will 404 in production, which is exactly what we want to test for graceful degradation.
const MODEL_URL = '/models/pixeltruth-detector-v1.onnx';

async function checkWebGPU() {
  if (!navigator.gpu) return false;
  try {
    const adapter = await navigator.gpu.requestAdapter();
    return adapter !== null;
  } catch {
    return false;
  }
}

self.onmessage = async (e) => {
  const { id, type, action, payload } = e.data;
  
  if (type === 'CANCEL') {
    adapter.unload().catch(console.error);
    return;
  }
  
  if (type !== 'START') return;

  if (action === 'ANALYZE_IMAGE') {
    const { fileBlob } = payload;
    
    const reportProgress = (state) => {
      self.postMessage({ id, type: 'PROGRESS', state });
    };

    try {
      // 1. Determine execution provider
      const hasWebGPU = await checkWebGPU();
      const provider = hasWebGPU ? 'webgpu' : 'wasm';
      
      const t0 = performance.now();
      
      // 2. Load
      await adapter.load(MODEL_URL, provider, reportProgress);
      const tLoad = performance.now() - t0;
      
      reportProgress('PREPROCESSING');
      const bitmap = await createImageBitmap(fileBlob);
      const tensor = await adapter.preprocess(bitmap);
      
      reportProgress('INFERENCE');
      const t1 = performance.now();
      const results = await adapter.infer(tensor);
      const tInference = performance.now() - t1;
      
      reportProgress('POSTPROCESSING');
      const finalResult = adapter.postprocess(results);
      
      // Append performance metrics
      finalResult.metrics = {
        loadTimeMs: tLoad.toFixed(2),
        inferenceTimeMs: tInference.toFixed(2)
      };

      reportProgress('COMPLETE');
      
      self.postMessage({ id, type: 'COMPLETE', result: finalResult });
      
    } catch (error) {
      console.error('AI Worker error:', error);
      self.postMessage({ id, type: 'ERROR', error: error.message || 'AI inference failed' });
    }
  }
};
