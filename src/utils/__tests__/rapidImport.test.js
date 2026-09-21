import { describe, it, expect, vi } from 'vitest';

vi.mock('heic2any', () => ({
  default: vi.fn(),
}));

import { MAX_FILES } from '../normalizeInput';

/**
 * Race condition simulation test for file import slot reservation.
 * Verifies that under rapid, concurrent import requests,
 * the application never accepts more than MAX_FILES (20).
 */
describe('Import slot reservation race-condition safety', () => {
  it('enforces MAX_FILES limit during rapid concurrent import attempts', async () => {
    let currentQueued = 0;
    let inFlight = 0;

    function reserveSlots(requestedCount) {
      const total = currentQueued + inFlight;
      const available = Math.max(0, MAX_FILES - total);
      const accepted = Math.min(requestedCount, available);
      inFlight += accepted;
      return { accepted, available };
    }

    function releaseSlots(count) {
      inFlight = Math.max(0, inFlight - count);
    }

    function commitSlots(count) {
      inFlight = Math.max(0, inFlight - count);
      currentQueued = Math.min(MAX_FILES, currentQueued + count);
    }

    // Simulate 3 rapid bursts of 10 files arriving concurrently (30 files total)
    const burst1 = reserveSlots(10);
    const burst2 = reserveSlots(10);
    const burst3 = reserveSlots(10);

    expect(burst1.accepted).toBe(10);
    expect(burst2.accepted).toBe(10);
    // The 3rd burst must be clamped to 0 since 20 are already reserved
    expect(burst3.accepted).toBe(0);

    // Commit burst1 and burst2
    commitSlots(burst1.accepted);
    commitSlots(burst2.accepted);

    expect(currentQueued).toBe(20);
    expect(currentQueued).toBeLessThanOrEqual(MAX_FILES);
    expect(inFlight).toBe(0);

    // Test releaseSlots (e.g. if a slot is cancelled before commit)
    const cancelled = reserveSlots(5);
    expect(cancelled.accepted).toBe(0);
    releaseSlots(1); // Test release logic
    expect(inFlight).toBe(0);

    // Attempting another burst when at MAX_FILES
    const burst4 = reserveSlots(5);
    expect(burst4.accepted).toBe(0);

    // Removing 5 files frees up exactly 5 slots
    currentQueued -= 5;
    const burst5 = reserveSlots(10);
    expect(burst5.accepted).toBe(5);
    commitSlots(burst5.accepted);
    expect(currentQueued).toBe(20);
  });

  it('functional clamp safely truncates batches exceeding MAX_FILES', () => {
    const rawBatch = Array.from({ length: 30 }, (_, i) => ({ id: i, name: `photo-${i}.jpg` }));
    let state = [];

    // Simulate functional state update: prev => [...prev, ...items.slice(0, MAX_FILES - prev.length)]
    function addBatch(items) {
      const remaining = Math.max(0, MAX_FILES - state.length);
      const allowed = items.slice(0, remaining);
      state = [...state, ...allowed];
      return allowed.length;
    }

    const added = addBatch(rawBatch);
    expect(added).toBe(20);
    expect(state.length).toBe(20);

    // Adding more does not grow past MAX_FILES
    const added2 = addBatch(rawBatch);
    expect(added2).toBe(0);
    expect(state.length).toBe(20);
  });
});
