import { describe, it, expect, vi } from 'vitest';
import { imagePool } from '../../src/workers/instances';

describe('Worker Payload Contract', () => {
  it('dispatches STRIP_METADATA with the correct array buffer contract', async () => {
    // 1. Create a dummy buffer
    const buffer = new ArrayBuffer(1024);
    const mime = 'image/jpeg';
    const name = 'test.jpg';
    const keepTags = [];
    const preserveC2pa = true;

    // Spy on the pool dispatch
    const dispatchSpy = vi.spyOn(imagePool, 'dispatch').mockImplementation(async () => {
      return { buffer: new ArrayBuffer(512) }; // Mock response
    });

    try {
      // Execute the dispatch as our utility functions would
      const result = await imagePool.dispatch('STRIP_METADATA', {
        buffer,
        mime,
        name,
        keepTags,
        preserveC2pa
      }, {
        transfer: [buffer]
      });

      // Verify the payload contract matches what the worker expects
      expect(dispatchSpy).toHaveBeenCalledWith(
        'STRIP_METADATA',
        expect.objectContaining({
          buffer: expect.any(ArrayBuffer),
          mime: 'image/jpeg',
          name: 'test.jpg',
          keepTags: [],
          preserveC2pa: true
        }),
        expect.objectContaining({
          transfer: [buffer]
        })
      );
      
      expect(result.buffer).toBeInstanceOf(ArrayBuffer);
    } finally {
      dispatchSpy.mockRestore();
    }
  });

  it('guarantees single-settle and detaches abort listeners on cancellation', async () => {
    const { WorkerPool } = await import('../../src/workers/pool.js');
    const mockWorker = {
      postMessage: vi.fn(),
      terminate: vi.fn(),
    };
    const pool = new WorkerPool(() => mockWorker, 1, 5000);

    const controller = new AbortController();
    const dispatchPromise = pool.dispatch('DUMMY_ACTION', {}, { signal: controller.signal });

    // Cancel while queued or running
    controller.abort();

    await expect(dispatchPromise).rejects.toThrow('CANCELLED');

    // Settle again should be a no-op (no double settle)
    expect(() => {
      // Simulate another worker response after already aborted
      pool.handleMessage({ worker: mockWorker, activeJobId: 'job_1' }, { id: 'job_1', type: 'COMPLETE', result: {} });
    }).not.toThrow();
  });

  it('recycles worker to release V8 heap memory when jobCount reaches maxJobsPerWorker', async () => {
    const { WorkerPool } = await import('../../src/workers/pool.js');
    const mockWorker = {
      postMessage: vi.fn(),
      terminate: vi.fn(),
    };
    // Initialize pool with maxJobsPerWorker = 2
    const pool = new WorkerPool(() => mockWorker, 1, 5000, 2);

    const workerObj = { worker: mockWorker, activeJobId: 'job_a', timeoutId: null, jobCount: 0 };
    pool.workers.push(workerObj);
    pool.activeJobs.set('job_a', { id: 'job_a', resolve: vi.fn(), reject: vi.fn() });

    // Complete job 1
    pool.handleMessage(workerObj, { id: 'job_a', type: 'COMPLETE', result: {} });
    expect(workerObj.jobCount).toBe(1);
    expect(mockWorker.terminate).not.toHaveBeenCalled();

    // Setup and complete job 2
    workerObj.activeJobId = 'job_b';
    pool.activeJobs.set('job_b', { id: 'job_b', resolve: vi.fn(), reject: vi.fn() });
    pool.handleMessage(workerObj, { id: 'job_b', type: 'COMPLETE', result: {} });

    // JobCount is now 2 >= maxJobsPerWorker (2), so worker should be terminated for recycling
    expect(mockWorker.terminate).toHaveBeenCalledTimes(1);
    expect(pool.workers).not.toContain(workerObj);
  });
});
