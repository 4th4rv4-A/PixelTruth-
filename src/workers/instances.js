import { WorkerPool } from './pool';

export const imagePool = new WorkerPool(
  () => new Worker(new URL('./image.worker.js', import.meta.url), { type: 'module' })
);

// Singleton instance of the C2PA Worker Pool
// Used to read Content Credentials for display (WASM-backed validation)
export const c2paPool = new WorkerPool(
  () => new Worker(new URL('./c2pa.worker.js', import.meta.url), { type: 'module' }),
  2,        // lower concurrency for WASM-heavy tasks
  120000    // 2 min timeout since WASM init can be slow
);
