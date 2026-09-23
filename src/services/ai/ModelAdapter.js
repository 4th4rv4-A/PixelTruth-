import * as ort from 'onnxruntime-web';

// Configure ONNX Runtime Web environments.
// We configure it to load WASM files from the public directory or CDN.
// In a Vite environment, if not bundled explicitly, it usually pulls from JSDelivr by default.
// For production, these should be locally hosted.
ort.env.wasm.numThreads = 1; 

export class ModelAdapter {
  constructor() {
    this.session = null;
    this.modelUrl = null;
    this.provider = null;
  }

  /**
   * Initializes the ONNX session with the given model URL and execution provider.
   * @param {string} modelUrl 
   * @param {string} provider ('webgpu' or 'wasm')
   * @param {function} onProgress Callback for download progress
   */
  async load(modelUrl, provider = 'wasm', onProgress = null) {
    this.modelUrl = modelUrl;
    this.provider = provider;
    
    if (onProgress) onProgress('DOWNLOADING_MODEL');

    try {
      // In a real application, you would manually fetch with progress here,
      // but ort.InferenceSession.create accepts a URL directly or an ArrayBuffer.
      // We'll fetch it manually to simulate handling 404s cleanly.
      const response = await fetch(modelUrl);
      if (!response.ok) {
        throw new Error(`Failed to download model: ${response.status} ${response.statusText}`);
      }
      
      const buffer = await response.arrayBuffer();
      
      if (onProgress) onProgress('INITIALIZING');
      
      this.session = await ort.InferenceSession.create(buffer, {
        executionProviders: [provider],
        graphOptimizationLevel: 'all'
      });
      
    } catch (err) {
      throw new Error(`Model initialization failed: ${err.message}`);
    }
  }

  /**
   * Frees WASM/GPU memory.
   */
  async unload() {
    if (this.session) {
      await this.session.release();
      this.session = null;
    }
  }

  /**
   * Preprocesses an ImageBitmap into an ONNX Tensor.
   * @param {ImageBitmap} imageBitmap 
   * @returns {ort.Tensor}
   */
  async preprocess(imageBitmap) {
    // 1. Resize to 224x224 (standard for many vision models)
    const targetSize = 224;
    const canvas = new OffscreenCanvas(targetSize, targetSize);
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    
    // Simple center crop + resize
    const minDim = Math.min(imageBitmap.width, imageBitmap.height);
    const sx = (imageBitmap.width - minDim) / 2;
    const sy = (imageBitmap.height - minDim) / 2;
    
    ctx.drawImage(imageBitmap, sx, sy, minDim, minDim, 0, 0, targetSize, targetSize);
    const imgData = ctx.getImageData(0, 0, targetSize, targetSize).data;

    // 2. Normalize and construct Float32Array (CHW format typically)
    const float32Data = new Float32Array(3 * targetSize * targetSize);
    
    // ImageNet means/stds usually used
    const mean = [0.485, 0.456, 0.406];
    const std = [0.229, 0.224, 0.225];

    let rOffset = 0;
    let gOffset = targetSize * targetSize;
    let bOffset = targetSize * targetSize * 2;

    for (let i = 0; i < imgData.length; i += 4) {
      // Normalize to 0-1 then apply mean/std
      float32Data[rOffset++] = (imgData[i] / 255.0 - mean[0]) / std[0];
      float32Data[gOffset++] = (imgData[i + 1] / 255.0 - mean[1]) / std[1];
      float32Data[bOffset++] = (imgData[i + 2] / 255.0 - mean[2]) / std[2];
    }

    return new ort.Tensor('float32', float32Data, [1, 3, targetSize, targetSize]);
  }

  /**
   * Runs inference on the tensor.
   * @param {ort.Tensor} tensor 
   */
  async infer(tensor) {
    if (!this.session) throw new Error('Session not initialized');
    
    // The input name depends on the model. 'input' is common.
    const inputName = this.session.inputNames[0];
    const feeds = { [inputName]: tensor };
    
    const results = await this.session.run(feeds);
    return results;
  }

  /**
   * Maps raw logits to the standardized result object.
   * @param {Object} results 
   */
  postprocess(results) {
    const outputName = this.session.outputNames[0];
    const outputTensor = results[outputName];
    const data = outputTensor.data; // Float32Array of logits

    // Softmax
    let max = -Infinity;
    for (let i = 0; i < data.length; i++) if (data[i] > max) max = data[i];
    
    let sum = 0;
    const probs = new Float32Array(data.length);
    for (let i = 0; i < data.length; i++) {
      probs[i] = Math.exp(data[i] - max);
      sum += probs[i];
    }
    for (let i = 0; i < data.length; i++) probs[i] /= sum;

    // Hypothetical assumption: class 1 is synthetic.
    const syntheticScore = probs.length > 1 ? probs[1] : probs[0];

    return {
      syntheticLikelihood: syntheticScore,
      modelScore: syntheticScore, // Raw score
      signalStrength: syntheticScore > 0.8 ? 'HIGH' : syntheticScore > 0.5 ? 'MODERATE' : 'LOW',
      modelVersion: 'pixeltruth-detector-v1',
      runtime: 'onnxruntime-web',
      executionProvider: this.provider,
      inputResolution: '224x224',
      limitations: [
        'Adversarial adaptation: Models can be bypassed by noise patterns.',
        'Resizing: Aggressive downscaling removes forensic traces.',
        'Unseen generators: Zero-day models have a different distribution.',
        'Not a calibrated probability: Scores are confidence heuristics, not absolute truth.'
      ]
    };
  }
}
