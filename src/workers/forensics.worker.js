import { fft2d, fftshift } from '../utils/fft';

// Standard 512x512 resolution for FFT to ensure radix-2 compatibility and performance
const FFT_SIZE = 512;

/**
 * Computes Error Level Analysis (ELA) using an OffscreenCanvas.
 */
async function runELA(fileBlob, quality = 0.9) {
  // Decode original image
  const originalBitmap = await createImageBitmap(fileBlob);
  const width = originalBitmap.width;
  const height = originalBitmap.height;

  // Max cap for ELA to avoid out-of-memory on massive images
  const MAX_DIM = 2048;
  let scale = 1;
  if (width > MAX_DIM || height > MAX_DIM) {
    scale = Math.min(MAX_DIM / width, MAX_DIM / height);
  }
  
  const targetW = Math.round(width * scale);
  const targetH = Math.round(height * scale);

  const canvas = new OffscreenCanvas(targetW, targetH);
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  
  // Draw original and extract pixels
  ctx.drawImage(originalBitmap, 0, 0, targetW, targetH);
  const origData = ctx.getImageData(0, 0, targetW, targetH).data;

  // Re-encode to JPEG
  const jpegBlob = await canvas.convertToBlob({ type: 'image/jpeg', quality });
  
  // Decode re-encoded image
  const jpegBitmap = await createImageBitmap(jpegBlob);
  ctx.drawImage(jpegBitmap, 0, 0, targetW, targetH);
  const jpegData = ctx.getImageData(0, 0, targetW, targetH).data;

  // Compute absolute difference & amplify
  const diffData = new Uint8ClampedArray(targetW * targetH * 4);
  const ERROR_SCALE = 15; // Amplify differences
  
  let maxDiff = 0;

  for (let i = 0; i < origData.length; i += 4) {
    const r = Math.abs(origData[i] - jpegData[i]);
    const g = Math.abs(origData[i+1] - jpegData[i+1]);
    const b = Math.abs(origData[i+2] - jpegData[i+2]);
    
    const diff = Math.max(r, g, b);
    if (diff > maxDiff) maxDiff = diff;

    // Heatmap style mapping or just amplified grayscale
    // We'll use a grayscale mapping for pure ELA 
    const v = Math.min(255, diff * ERROR_SCALE);
    diffData[i] = v;
    diffData[i+1] = v;
    diffData[i+2] = v;
    diffData[i+3] = 255; // Alpha
  }

  // To send this back, we can send an ImageData object or just the buffer
  return {
    width: targetW,
    height: targetH,
    buffer: diffData.buffer,
    maxDiff,
    summary: 'Elevated local compression difference detected.',
    warnings: ['Edges naturally produce high differences. ELA does not prove AI generation.']
  };
}

/**
 * Computes 2D Fast Fourier Transform Magnitude Spectrum.
 */
async function runFFT(fileBlob) {
  const originalBitmap = await createImageBitmap(fileBlob);
  
  const canvas = new OffscreenCanvas(FFT_SIZE, FFT_SIZE);
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  
  // Downscale/upscale and crop to center to make it FFT_SIZE x FFT_SIZE
  const minDim = Math.min(originalBitmap.width, originalBitmap.height);
  const sx = (originalBitmap.width - minDim) / 2;
  const sy = (originalBitmap.height - minDim) / 2;
  
  ctx.drawImage(originalBitmap, sx, sy, minDim, minDim, 0, 0, FFT_SIZE, FFT_SIZE);
  
  const imgData = ctx.getImageData(0, 0, FFT_SIZE, FFT_SIZE).data;
  
  const N = FFT_SIZE;
  const real = new Float32Array(N * N);
  const imag = new Float32Array(N * N);

  // Convert to grayscale luminance
  for (let i = 0; i < N * N; i++) {
    const r = imgData[i * 4];
    const g = imgData[i * 4 + 1];
    const b = imgData[i * 4 + 2];
    real[i] = 0.299 * r + 0.587 * g + 0.114 * b; 
    imag[i] = 0;
  }

  // Apply 2D FFT in-place
  fft2d(real, imag, N);

  // Compute magnitude: sqrt(real^2 + imag^2)
  const magnitude = new Float32Array(N * N);
  let maxMag = 0;
  for (let i = 0; i < N * N; i++) {
    const mag = Math.sqrt(real[i] * real[i] + imag[i] * imag[i]);
    // Log scale: log(1 + mag)
    const logMag = Math.log(1 + mag);
    magnitude[i] = logMag;
    if (logMag > maxMag) maxMag = logMag;
  }

  // Shift zero frequency to center
  const shifted = fftshift(magnitude, N);

  // Normalize to 0-255 for display
  const outData = new Uint8ClampedArray(N * N * 4);
  for (let i = 0; i < N * N; i++) {
    // contrast enhancement
    let v = (shifted[i] / maxMag) * 255; 
    v = Math.min(255, v * 1.5); // Boost visual brightness

    outData[i * 4] = v;
    outData[i * 4 + 1] = v;
    outData[i * 4 + 2] = v;
    outData[i * 4 + 3] = 255;
  }

  return {
    width: N,
    height: N,
    buffer: outData.buffer,
    summary: 'Frequency domain spectrum generated.',
    warnings: ['Regular grid patterns can indicate GANs, but also natural textures or upscaling.']
  };
}

self.onmessage = async (e) => {
  const { id, type, action, payload } = e.data;
  
  if (type === 'CANCEL') return;
  if (type !== 'START') return;

  try {
    if (action === 'RUN_ELA') {
      const { fileBlob } = payload;
      const result = await runELA(fileBlob);
      self.postMessage({ id, type: 'COMPLETE', result }, [result.buffer]);
    } else if (action === 'RUN_FFT') {
      const { fileBlob } = payload;
      const result = await runFFT(fileBlob);
      self.postMessage({ id, type: 'COMPLETE', result }, [result.buffer]);
    } else {
      throw new Error(`Unknown action: ${action}`);
    }
  } catch (error) {
    self.postMessage({ id, type: 'ERROR', error: error.message || 'Worker error' });
  }
};
