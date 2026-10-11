import { WorkerPool } from './pool';

// Singleton instance of the Image Worker Pool
// Used for readMetadata and stripMetadata
export const imagePool = new WorkerPool(
  () => new Worker(new URL('./image.worker.js', import.meta.url), { type: 'module' })
);


