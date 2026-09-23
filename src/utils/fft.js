/**
 * Performs an in-place Cooley-Tukey Radix-2 1D FFT.
 * Modifies the provided `real` and `imag` arrays.
 * The length of the arrays MUST be a power of 2.
 */
export function fft1d(real, imag) {
  const n = real.length;
  
  // Bit-reversal permutation
  let j = 0;
  for (let i = 0; i < n - 1; i++) {
    if (i < j) {
      const tr = real[i], ti = imag[i];
      real[i] = real[j]; imag[i] = imag[j];
      real[j] = tr; imag[j] = ti;
    }
    let m = n >> 1;
    while (j >= m) {
      j -= m;
      m >>= 1;
    }
    j += m;
  }
  
  // Cooley-Tukey decimation-in-time
  for (let size = 2; size <= n; size <<= 1) {
    const half = size >> 1;
    const angle = -2 * Math.PI / size;
    const wReal = Math.cos(angle);
    const wImag = Math.sin(angle);
    
    for (let i = 0; i < n; i += size) {
      let wr = 1, wi = 0;
      for (let k = 0; k < half; k++) {
        const idx = i + k;
        const jdx = idx + half;
        
        const tr = wr * real[jdx] - wi * imag[jdx];
        const ti = wr * imag[jdx] + wi * real[jdx];
        
        real[jdx] = real[idx] - tr;
        imag[jdx] = imag[idx] - ti;
        
        real[idx] += tr;
        imag[idx] += ti;
        
        // Next twiddle factor
        const nextWr = wr * wReal - wi * wImag;
        wi = wr * wImag + wi * wReal;
        wr = nextWr;
      }
    }
  }
}

/**
 * 2D FFT for a square matrix of size N x N (where N is a power of 2).
 * Modifies the `real` and `imag` flat arrays in-place.
 */
export function fft2d(real, imag, n) {
  const rowReal = new Float32Array(n);
  const rowImag = new Float32Array(n);

  // Transform rows
  for (let y = 0; y < n; y++) {
    const offset = y * n;
    // Copy row
    for (let x = 0; x < n; x++) {
      rowReal[x] = real[offset + x];
      rowImag[x] = imag[offset + x];
    }
    
    fft1d(rowReal, rowImag);
    
    // Put back
    for (let x = 0; x < n; x++) {
      real[offset + x] = rowReal[x];
      imag[offset + x] = rowImag[x];
    }
  }

  // Transform columns
  for (let x = 0; x < n; x++) {
    // Copy col
    for (let y = 0; y < n; y++) {
      rowReal[y] = real[y * n + x];
      rowImag[y] = imag[y * n + x];
    }
    
    fft1d(rowReal, rowImag);
    
    // Put back
    for (let y = 0; y < n; y++) {
      real[y * n + x] = rowReal[y];
      imag[y * n + x] = rowImag[y];
    }
  }
}

/**
 * Shifts the zero-frequency (DC) component to the center of the spectrum.
 */
export function fftshift(magnitude, n) {
  const half = n / 2;
  const shifted = new Float32Array(n * n);

  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      const shiftX = (x + half) % n;
      const shiftY = (y + half) % n;
      shifted[shiftY * n + shiftX] = magnitude[y * n + x];
    }
  }
  return shifted;
}
