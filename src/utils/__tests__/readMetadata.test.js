import { describe, it, expect } from 'vitest';
import { getPrivacyLevel } from '../readMetadata';

describe('getPrivacyLevel', () => {
  it('returns "high" when GPS latitude is present', () => {
    expect(getPrivacyLevel({ GPSLatitude: 37.7749 })).toBe('high');
  });

  it('returns "high" when GPS longitude is present', () => {
    expect(getPrivacyLevel({ GPSLongitude: -122.4194 })).toBe('high');
  });

  it('returns "high" when GPS latitude is exactly 0 (not falsy)', () => {
    expect(getPrivacyLevel({ GPSLatitude: 0, GPSLongitude: 0 })).toBe('high');
  });

  it('returns "high" for latitude key (exifr translated)', () => {
    expect(getPrivacyLevel({ latitude: 0 })).toBe('high');
  });

  it('returns "high" for longitude key (exifr translated)', () => {
    expect(getPrivacyLevel({ longitude: 51.5074 })).toBe('high');
  });

  it('returns "medium" for camera make', () => {
    expect(getPrivacyLevel({ Make: 'Apple' })).toBe('medium');
  });

  it('returns "medium" for camera model', () => {
    expect(getPrivacyLevel({ Model: 'iPhone 15 Pro' })).toBe('medium');
  });

  it('returns "medium" for lens info', () => {
    expect(getPrivacyLevel({ LensMake: 'Canon' })).toBe('medium');
  });

  it('returns "medium" for software tag', () => {
    expect(getPrivacyLevel({ Software: 'Adobe Photoshop' })).toBe('medium');
  });

  it('returns "medium" for artist/creator info', () => {
    expect(getPrivacyLevel({ Artist: 'John Doe' })).toBe('medium');
  });

  it('returns "medium" for copyright', () => {
    expect(getPrivacyLevel({ Copyright: '© 2024' })).toBe('medium');
  });

  it('returns "medium" for owner name', () => {
    expect(getPrivacyLevel({ OwnerName: 'Jane Smith' })).toBe('medium');
  });

  it('returns "medium" for capture timestamps', () => {
    expect(getPrivacyLevel({ DateTimeOriginal: '2024:01:15 10:30:00' })).toBe('medium');
  });

  it('returns "medium" for serial numbers', () => {
    expect(getPrivacyLevel({ SerialNumber: 'ABC123' })).toBe('medium');
  });

  it('returns "medium" for user comments', () => {
    expect(getPrivacyLevel({ UserComment: 'My vacation photo' })).toBe('medium');
  });

  it('returns "medium" for image description', () => {
    expect(getPrivacyLevel({ ImageDescription: 'Sunset at the beach' })).toBe('medium');
  });

  it('returns "low" for empty metadata', () => {
    expect(getPrivacyLevel({})).toBe('low');
  });

  it('returns "low" for metadata with only non-sensitive tags', () => {
    expect(getPrivacyLevel({
      ImageWidth: 4032,
      ImageHeight: 3024,
      ColorSpace: 1,
    })).toBe('low');
  });

  it('returns "low" when sensitive tags are null', () => {
    expect(getPrivacyLevel({ GPSLatitude: null })).toBe('low');
  });

  it('returns "low" when sensitive tags are undefined', () => {
    expect(getPrivacyLevel({ GPSLatitude: undefined })).toBe('low');
  });

  it('returns "low" when sensitive tags are empty strings', () => {
    expect(getPrivacyLevel({ Make: '' })).toBe('low');
  });

  it('prioritizes GPS over device info', () => {
    expect(getPrivacyLevel({
      Make: 'Apple',
      Model: 'iPhone',
      GPSLatitude: 40.7128,
    })).toBe('high');
  });
});
