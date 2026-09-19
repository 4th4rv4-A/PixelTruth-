import { describe, it, expect } from 'vitest';
import { VERDICTS } from '../verdicts';

describe('VERDICTS constants', () => {
  it('has all expected verdict values', () => {
    expect(VERDICTS.VERIFIED_AI).toBe('verified-ai');
    expect(VERDICTS.VERIFIED_PROVENANCE).toBe('verified-provenance');
    expect(VERDICTS.POSSIBLE).toBe('possible');
    expect(VERDICTS.INCONCLUSIVE).toBe('inconclusive');
  });

  it('verified verdicts start with "verified"', () => {
    expect(VERDICTS.VERIFIED_AI.startsWith('verified')).toBe(true);
    expect(VERDICTS.VERIFIED_PROVENANCE.startsWith('verified')).toBe(true);
  });

  it('non-verified verdicts do not start with "verified"', () => {
    expect(VERDICTS.POSSIBLE.startsWith('verified')).toBe(false);
    expect(VERDICTS.INCONCLUSIVE.startsWith('verified')).toBe(false);
  });
});

/**
 * C2PA Validation State Machine Tests
 *
 * These tests validate the verdict decision logic against
 * the expected state machine:
 *
 * manifest absent                              → inconclusive
 * manifest present + validation invalid        → inconclusive
 * manifest present + validation valid + AI     → verified-ai
 * manifest present + validation valid + no AI  → verified-provenance
 * manifest present + validation unavailable    → inconclusive (no crypto claim)
 */
describe('Verdict state machine logic', () => {
  /**
   * Helper that simulates the verdict decision logic from detectAI.js
   * without requiring actual C2PA library calls.
   */
  function determineVerdict({ hasManifest, validationState, hasAiMarker }) {
    if (!hasManifest) return VERDICTS.INCONCLUSIVE;

    const isVerified = validationState === 'Valid' || validationState === 'Trusted';
    if (!isVerified) return VERDICTS.INCONCLUSIVE;

    return hasAiMarker ? VERDICTS.VERIFIED_AI : VERDICTS.VERIFIED_PROVENANCE;
  }

  it('returns inconclusive when no manifest is found', () => {
    expect(determineVerdict({
      hasManifest: false,
      validationState: null,
      hasAiMarker: false,
    })).toBe(VERDICTS.INCONCLUSIVE);
  });

  it('returns inconclusive when manifest present but validation is "Invalid"', () => {
    expect(determineVerdict({
      hasManifest: true,
      validationState: 'Invalid',
      hasAiMarker: true,
    })).toBe(VERDICTS.INCONCLUSIVE);
  });

  it('returns inconclusive when manifest present but validation is null', () => {
    expect(determineVerdict({
      hasManifest: true,
      validationState: null,
      hasAiMarker: true,
    })).toBe(VERDICTS.INCONCLUSIVE);
  });

  it('returns inconclusive when manifest present but validation is undefined', () => {
    expect(determineVerdict({
      hasManifest: true,
      validationState: undefined,
      hasAiMarker: false,
    })).toBe(VERDICTS.INCONCLUSIVE);
  });

  it('returns verified-ai when validation is "Valid" and AI marker found', () => {
    expect(determineVerdict({
      hasManifest: true,
      validationState: 'Valid',
      hasAiMarker: true,
    })).toBe(VERDICTS.VERIFIED_AI);
  });

  it('returns verified-ai when validation is "Trusted" and AI marker found', () => {
    expect(determineVerdict({
      hasManifest: true,
      validationState: 'Trusted',
      hasAiMarker: true,
    })).toBe(VERDICTS.VERIFIED_AI);
  });

  it('returns verified-provenance when validation is "Valid" but no AI marker', () => {
    expect(determineVerdict({
      hasManifest: true,
      validationState: 'Valid',
      hasAiMarker: false,
    })).toBe(VERDICTS.VERIFIED_PROVENANCE);
  });

  it('returns verified-provenance when validation is "Trusted" but no AI marker', () => {
    expect(determineVerdict({
      hasManifest: true,
      validationState: 'Trusted',
      hasAiMarker: false,
    })).toBe(VERDICTS.VERIFIED_PROVENANCE);
  });

  it('does not claim verified for unknown validation states', () => {
    expect(determineVerdict({
      hasManifest: true,
      validationState: 'SomeUnknownState',
      hasAiMarker: true,
    })).toBe(VERDICTS.INCONCLUSIVE);
  });
});

/**
 * Credential details visibility tests
 */
describe('Credential details visibility', () => {
  function shouldShowCredentials(verdict) {
    return verdict?.startsWith('verified') ?? false;
  }

  it('shows for verified-ai', () => {
    expect(shouldShowCredentials(VERDICTS.VERIFIED_AI)).toBe(true);
  });

  it('shows for verified-provenance', () => {
    expect(shouldShowCredentials(VERDICTS.VERIFIED_PROVENANCE)).toBe(true);
  });

  it('hidden for possible', () => {
    expect(shouldShowCredentials(VERDICTS.POSSIBLE)).toBe(false);
  });

  it('hidden for inconclusive', () => {
    expect(shouldShowCredentials(VERDICTS.INCONCLUSIVE)).toBe(false);
  });

  it('hidden for null', () => {
    expect(shouldShowCredentials(null)).toBe(false);
  });

  it('hidden for undefined', () => {
    expect(shouldShowCredentials(undefined)).toBe(false);
  });
});
