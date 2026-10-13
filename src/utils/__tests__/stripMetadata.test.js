import { describe, it, expect, vi, beforeEach } from 'vitest';
import { cleanImageFile, stripFull, stripSelective } from '../stripMetadata';

// Mock the imagePool worker instance
vi.mock('../../workers/instances', () => ({
  imagePool: {
    dispatch: vi.fn(),
  },
}));

import { imagePool } from '../../workers/instances';

describe('stripMetadata service functions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    imagePool.dispatch.mockResolvedValue({
      buffer: new Uint8Array([1, 2, 3, 4]).buffer,
    });
  });

  describe('cleanImageFile router', () => {
    it('routes JPEG with keepTags to stripSelective', async () => {
      const file = new File([new Uint8Array([0xff, 0xd8, 0xff])], 'test.jpg', {
        type: 'image/jpeg',
      });

      const blob = await cleanImageFile(file, {
        keepTags: ['Orientation', 'Artist'],
        fullSanitize: true,
      });

      expect(imagePool.dispatch).toHaveBeenCalledWith(
        'STRIP_METADATA',
        expect.objectContaining({
          mime: 'image/jpeg',
          name: 'test.jpg',
          keepTags: ['Orientation', 'Artist'],
          fullSanitize: true,
        }),
        expect.any(Object)
      );

      expect(blob.type).toBe('image/jpeg');
    });

    it('routes JPEG with empty keepTags to stripFull', async () => {
      const file = new File([new Uint8Array([0xff, 0xd8, 0xff])], 'test.jpg', {
        type: 'image/jpeg',
      });

      const blob = await cleanImageFile(file, {
        keepTags: [],
        fullSanitize: false,
      });

      expect(imagePool.dispatch).toHaveBeenCalledWith(
        'STRIP_METADATA',
        expect.objectContaining({
          mime: 'image/jpeg',
          keepTags: [],
          fullSanitize: false,
        }),
        expect.any(Object)
      );

      expect(blob.type).toBe('image/jpeg');
    });

    it('routes PNG with keepTags to stripFull because PNG selective strip is unsupported', async () => {
      const file = new File([new Uint8Array([0x89, 0x50, 0x4e, 0x47])], 'test.png', {
        type: 'image/png',
      });

      const blob = await cleanImageFile(file, {
        keepTags: ['Artist'],
        fullSanitize: false,
      });

      expect(imagePool.dispatch).toHaveBeenCalledWith(
        'STRIP_METADATA',
        expect.objectContaining({
          mime: 'image/png',
          keepTags: [],
        }),
        expect.any(Object)
      );

      expect(blob.type).toBe('image/png');
    });

    it('routes WebP images to stripFull with image/webp output', async () => {
      const file = new File([new Uint8Array([0x52, 0x49, 0x46, 0x46])], 'test.webp', {
        type: 'image/webp',
      });

      const blob = await cleanImageFile(file);

      expect(imagePool.dispatch).toHaveBeenCalledWith(
        'STRIP_METADATA',
        expect.objectContaining({
          mime: 'image/webp',
        }),
        expect.any(Object)
      );

      expect(blob.type).toBe('image/webp');
    });

    it('forwards progress callbacks and abort signals correctly', async () => {
      const file = new File(['mock'], 'test.jpg', { type: 'image/jpeg' });
      const onProgress = vi.fn();
      const controller = new AbortController();

      await cleanImageFile(file, {
        onProgress,
        signal: controller.signal,
      });

      expect(imagePool.dispatch).toHaveBeenCalledWith(
        'STRIP_METADATA',
        expect.any(Object),
        expect.objectContaining({
          onProgress,
          signal: controller.signal,
        })
      );
    });
  });

  describe('direct stripFull and stripSelective functions', () => {
    it('stripFull dispatches with empty keepTags', async () => {
      const file = new File(['mock'], 'photo.jpg', { type: 'image/jpeg' });
      await stripFull(file, true);

      expect(imagePool.dispatch).toHaveBeenCalledWith(
        'STRIP_METADATA',
        expect.objectContaining({
          keepTags: [],
          fullSanitize: true,
        }),
        expect.any(Object)
      );
    });

    it('stripSelective dispatches with specified keepTags', async () => {
      const file = new File(['mock'], 'photo.jpg', { type: 'image/jpeg' });
      await stripSelective(file, ['Make', 'Model']);

      expect(imagePool.dispatch).toHaveBeenCalledWith(
        'STRIP_METADATA',
        expect.objectContaining({
          keepTags: ['Make', 'Model'],
        }),
        expect.any(Object)
      );
    });
  });
});
