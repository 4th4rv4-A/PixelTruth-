import { describe, it, expect } from 'vitest';
import { VERDICTS, shouldShowCredentials } from '../verdicts';
import { determineVerdict, isValidationVerified } from '../detectAI';

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

describe('isValidationVerified production helper', () => {
  it('returns true only for "Valid" or "Trusted"', () => {
    expect(isValidationVerified('Valid')).toBe(true);
    expect(isValidationVerified('Trusted')).toBe(true);
    expect(isValidationVerified('Invalid')).toBe(false);
    expect(isValidationVerified(null)).toBe(false);
    expect(isValidationVerified(undefined)).toBe(false);
    expect(isValidationVerified('Unknown')).toBe(false);
  });
});

/**
 * C2PA Validation State Machine Tests
 *
 * These tests validate the imported production determineVerdict function
 * against the expected semantic model:
 *
 * Case A: manifest absent                              → inconclusive (or possible if software tag matches)
 * Case B: manifest present + validation invalid        → inconclusive
 * Case C: manifest present + validation valid + AI     → verified-ai
 * Case D: manifest present + validation valid + no AI  → verified-provenance
 * Case E: manifest present + validation unavailable    → inconclusive (no crypto claim)
 */
describe('Verdict state machine logic (imported production function)', () => {

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
describe('Credential details visibility (imported shouldShowCredentials)', () => {
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
