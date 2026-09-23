# PixelTruth Performance Optimization

## Architecture & Worker Memory (Zero-Copy)

### The Problem
During heavy profiling, it was identified that when a user dropped a large image (e.g. 50MB) into the PixelTruth queue, the browser would consume **150MB+ of main thread memory**. 
This occurred because the application was calling `await file.arrayBuffer()` concurrently in three separate places to dispatch the data to Web Workers:
1. `readMetadata` -> `imagePool`
2. `detectAI` -> `c2paPool`
3. `InspectorView` -> `inspectorPool`

Every call to `file.arrayBuffer()` allocated a brand new block of RAM in the main thread.

### The Solution: Zero-Copy Blob Transfer
Web Workers use the structured clone algorithm. When transferring raw `ArrayBuffer` objects without neutering them (`transfer: [buffer]`), the buffer is either cloned, or if transferred, neutered (making it unusable for the other two parallel tasks). 

However, `Blob` and `File` objects are handled entirely by reference. 

We refactored all core utilities and workers to accept the `File` object natively. The workers now invoke `await file.arrayBuffer()` internally.
**Result**: The 50MB image uses exactly **0 bytes** of extra main thread memory during dispatch. The browser reads the bytes straight from the disk-backed Blob into the worker thread.

## Bundle Analysis & Precache Exclusions

### Current Baseline (Production Build)
- **Main App Shell** (`index.js`): ~475 kB (gzipped)
- **C2PA WASM** (`c2pa_bg.wasm`): 3.2 MB (gzipped)
- **ONNX Inference Engine** (`ort-wasm-simd-threaded.jsep.wasm`): 6.8 MB (gzipped)

### Lazy Loading Strategy
While the main application shell is cached proactively by `vite-plugin-pwa` for offline PWA usage, we must ensure the heavy analytical assets do not bloat the initial network hit for users who only want to strip metadata.

**Changes Applied**:
- The `vite.config.js` `globIgnores` now explicitly excludes `**/c2pa.worker-*.js`, `**/ai.worker-*.js`, and `**/*.wasm`.
- These assets will only be fetched over the network if and when the user clicks the "Forensic Inspector" tab or triggers a C2PA verification.

## Recommended Performance Budgets
To maintain the snappy "local app" feel:

1. **Initial Page Load JS (App Shell)**: 
   - **Budget**: < 500 KB gzipped.
   - **Current**: 475 KB (PASS)
2. **First Input Delay (FID)**: 
   - **Budget**: < 100ms.
   - **Current**: Zero-copy offloading ensures main thread is completely unblocked during ingestion.
3. **Lazy Asset Hydration**:
   - The AI WASM (6.8MB) is permitted to exceed normal web budgets purely because it is (a) opt-in via user interaction, and (b) executing a local neural network.
