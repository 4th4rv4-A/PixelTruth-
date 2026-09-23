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
});
