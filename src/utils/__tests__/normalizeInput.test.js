import { describe, it, expect, vi } from 'vitest';

vi.mock('heic2any', () => ({
  default: vi.fn(),
}));

import { MAX_PIXELS } from '../normalizeInput';

describe('MAX_PIXELS constant', () => {
  it('equals 64 megapixels', () => {
    expect(MAX_PIXELS).toBe(64 * 1024 * 1024);
  });
});
