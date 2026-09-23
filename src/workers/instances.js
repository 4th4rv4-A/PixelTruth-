import { WorkerPool } from './pool';

// Singleton instance of the Image Worker Pool
// Used for readMetadata and stripMetadata
export const imagePool = new WorkerPool(
  () => new Worker(new URL('./image.worker.js', import.meta.url), { type: 'module' })
);

// Singleton instance of the C2PA Worker Pool
// Used for detectAI
export const c2paPool = new WorkerPool(
  () => new Worker(new URL('./c2pa.worker.js', import.meta.url), { type: 'module' }),
  2, // Lower concurrency for WASM heavy tasks
  120000 // 2 min timeout for C2PA since it can be very slow
);

// Singleton instance of the Inspector Worker Pool
export const inspectorPool = new WorkerPool(
  () => new Worker(new URL('./inspector.worker.js', import.meta.url), { type: 'module' })
);

// Singleton instance of the Forensics Worker Pool
export const forensicsPool = new WorkerPool(
  () => new Worker(new URL('./forensics.worker.js', import.meta.url), { type: 'module' })
);

// Singleton instance of the AI Worker Pool
export const aiPool = new WorkerPool(
  () => new Worker(new URL('./ai.worker.js', import.meta.url), { type: 'module' })
);
