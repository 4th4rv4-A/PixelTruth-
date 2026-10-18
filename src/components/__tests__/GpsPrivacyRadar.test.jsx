import { describe, it, expect } from 'vitest';
import { renderToString } from 'react-dom/server';
import GpsPrivacyRadar from '../GpsPrivacyRadar';
import { I18nProvider } from '../../i18n';

describe('GpsPrivacyRadar Component', () => {
  const mockGpsInfo = {
    hasGps: true,
    latitude: 37.7749,
    longitude: -122.4194,
    formattedCoords: "37° 46' 29.6\" N, 122° 25' 09.8\" W",
    decimalCoords: '37.774900, -122.419400',
    altitude: '45.0 m (148 ft)',
    googleMapsUrl: 'https://www.google.com/maps?q=37.774900,-122.419400',
    appleMapsUrl: 'https://maps.apple.com/?q=37.774900,-122.419400',
    osmUrl: 'https://www.openstreetmap.org/?mlat=37.77490&mlon=-122.41940#map=16/37.77490/-122.41940',
    dateStamp: '2024:08:15',
    direction: '180.5°',
  };

  it('renders nothing if gpsInfo is missing or hasGps is false', () => {
    const html1 = renderToString(
      <I18nProvider>
        <GpsPrivacyRadar gpsInfo={null} />
      </I18nProvider>
    );
    expect(html1).toBe('');

    const html2 = renderToString(
      <I18nProvider>
        <GpsPrivacyRadar gpsInfo={{ hasGps: false }} />
      </I18nProvider>
    );
    expect(html2).toBe('');
  });

  it('renders exposed radar state with coordinates, warnings, and map links', () => {
    const html = renderToString(
      <I18nProvider>
        <GpsPrivacyRadar
          gpsInfo={mockGpsInfo}
          metadata={{ DateTimeOriginal: '2024:08:15 09:30:00' }}
          isCleaned={false}
          fileName="vacation.jpg"
        />
      </I18nProvider>
    );

    expect(html).toContain('data-testid="gps-privacy-radar"');
    expect(html).toContain('GPS Privacy Radar');
    expect(html).toContain('CRITICAL PRIVACY RISK');
    expect(html).toContain("37° 46&#x27;");
    expect(html).toContain("122° 25&#x27;");
    expect(html).toContain('37.774900, -122.419400');
    expect(html).toContain('45.0 m (148 ft)');
    expect(html).toContain('TARGET LOCKED');
    expect(html).toContain('https://www.google.com/maps?q=37.774900,-122.419400');
    expect(html).toContain('https://maps.apple.com/?q=37.774900,-122.419400');
    expect(html).toContain('openstreetmap.org');
    expect(html).toContain('vacation.jpg');
  });

  it('renders tactical radar SVG elements and cardinal points', () => {
    const html = renderToString(
      <I18nProvider>
        <GpsPrivacyRadar gpsInfo={mockGpsInfo} isCleaned={false} />
      </I18nProvider>
    );

    // Cardinal directions
    expect(html).toContain('>N<');
    expect(html).toContain('>E<');
    expect(html).toContain('>S<');
    expect(html).toContain('>W<');

    // Concentric range rings
    expect(html).toContain('1km');
    expect(html).toContain('250m');
    expect(html).toContain('50m');

    // Telemetry HUD items
    expect(html).toContain('SCAN: ACTIVE');
    expect(html).toContain('FIX: 3D DGPS');
  });

  it('renders redacted state when isCleaned is true', () => {
    const html = renderToString(
      <I18nProvider>
        <GpsPrivacyRadar gpsInfo={mockGpsInfo} isCleaned={true} fileName="cleaned_photo.jpg" />
      </I18nProvider>
    );

    expect(html).toContain('0 BYTES LEAKED');
    expect(html).toContain('PAYLOAD PURGED');
    expect(html).toContain('0 BYTES GPS EXIF');
    expect(html).toContain('STATUS: PURGED');
    expect(html).toContain('LEAKAGE: 0%');
    expect(html).toContain('████');
  });
});
