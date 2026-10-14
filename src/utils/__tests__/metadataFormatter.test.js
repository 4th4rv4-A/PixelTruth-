import { describe, it, expect } from 'vitest';
import {
  formatDms,
  formatExposureTime,
  formatFNumber,
  formatTagValue,
  extractGpsInfo,
  formatMetadataForClipboard,
} from '../metadataFormatter.js';

describe('metadataFormatter', () => {
  describe('formatDms', () => {
    it('converts positive latitude to N', () => {
      expect(formatDms(37.774929, true)).toContain('37° 46\'');
      expect(formatDms(37.774929, true)).toContain('N');
    });

    it('converts negative latitude to S', () => {
      expect(formatDms(-33.8688, true)).toContain('33° 52\'');
      expect(formatDms(-33.8688, true)).toContain('S');
    });

    it('converts negative longitude to W', () => {
      expect(formatDms(-122.419416, false)).toContain('122° 25\'');
      expect(formatDms(-122.419416, false)).toContain('W');
    });

    it('converts positive longitude to E', () => {
      expect(formatDms(139.6917, false)).toContain('139° 41\'');
      expect(formatDms(139.6917, false)).toContain('E');
    });
  });

  describe('formatExposureTime', () => {
    it('formats fast shutter speed as reciprocal fraction', () => {
      expect(formatExposureTime(0.004)).toBe('1/250s');
      expect(formatExposureTime(0.001)).toBe('1/1000s');
      expect(formatExposureTime(0.033333)).toBe('1/30s');
    });

    it('formats long exposure in whole or decimal seconds', () => {
      expect(formatExposureTime(2)).toBe('2s');
      expect(formatExposureTime(1.5)).toBe('1.5s');
    });
  });

  describe('formatFNumber', () => {
    it('formats f-stop numbers', () => {
      expect(formatFNumber(1.8)).toBe('f/1.8');
      expect(formatFNumber(2.8)).toBe('f/2.8');
      expect(formatFNumber(4)).toBe('f/4');
    });
  });

  describe('formatTagValue', () => {
    it('formats technical camera parameters accurately', () => {
      expect(formatTagValue('ExposureTime', 0.002)).toBe('1/500s');
      expect(formatTagValue('FNumber', 2.8)).toBe('f/2.8');
      expect(formatTagValue('FocalLength', 50)).toBe('50 mm');
      expect(formatTagValue('ISO', 400)).toBe('ISO 400');
      expect(formatTagValue('ExposureProgram', 3)).toBe('Aperture priority');
      expect(formatTagValue('MeteringMode', 5)).toBe('Pattern / Multi-segment');
      expect(formatTagValue('Orientation', 6)).toBe('Rotated 90° CW');
      expect(formatTagValue('WhiteBalance', 0)).toBe('Auto');
      expect(formatTagValue('ColorSpace', 1)).toBe('sRGB');
    });

    it('formats GPS coordinates with DMS', () => {
      const latFormatted = formatTagValue('GPSLatitude', 40.7128);
      expect(latFormatted).toContain('40.712800°');
      expect(latFormatted).toContain('N');
    });

    it('formats JFIF tags', () => {
      expect(formatTagValue('JFIFVersion', 257)).toBe('1.01');
      expect(formatTagValue('ResolutionUnit', 1)).toBe('inches');
    });
  });

  describe('extractGpsInfo', () => {
    it('extracts GPS and generates OpenStreetMap link', () => {
      const info = extractGpsInfo({
        latitude: 37.7749,
        longitude: -122.4194,
        GPSAltitude: 45.2,
      });

      expect(info.hasGps).toBe(true);
      expect(info.latitude).toBe(37.7749);
      expect(info.longitude).toBe(-122.4194);
      expect(info.mapUrl).toContain('openstreetmap.org');
      expect(info.mapUrl).toContain('37.77490');
      expect(info.formattedCoords).toContain('37° 46\'');
      expect(info.altitude).toContain('45.2 m');
    });

    it('returns hasGps false when coordinates are missing', () => {
      const info = extractGpsInfo({ Make: 'Apple', Model: 'iPhone' });
      expect(info.hasGps).toBe(false);
      expect(info.mapUrl).toBeNull();
    });
  });

  describe('formatMetadataForClipboard', () => {
    it('produces formatted key-value summary', () => {
      const text = formatMetadataForClipboard('photo.jpg', {
        Make: 'Sony',
        Model: 'A7R5',
        ISO: 100,
        __c2pa: [],
      });

      expect(text).toContain('=== Metadata: photo.jpg ===');
      expect(text).toContain('Make: Sony');
      expect(text).toContain('Model: A7R5');
      expect(text).toContain('ISO: ISO 100');
      expect(text).not.toContain('__c2pa');
    });
  });
});
