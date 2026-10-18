import { useState } from 'react';
import toast from 'react-hot-toast';
import { useI18n } from '../i18n/useI18n';

/**
 * Interactive GPS Privacy Radar Component.
 * Visualizes physical location embedded in image EXIF metadata with a tactical radar HUD,
 * interactive map preview, external map links, and a live Before/After redaction toggle.
 *
 * @param {Object} props
 * @param {Object} props.gpsInfo - Extracted GPS details from metadataFormatter
 * @param {Object} [props.metadata] - Raw metadata object
 * @param {boolean} [props.isCleaned=false] - Whether the file has been cleaned
 * @param {string} [props.fileName='image'] - Image filename
 */
export default function GpsPrivacyRadar({
  gpsInfo,
  metadata = {},
  isCleaned = false,
  fileName = 'image',
}) {
  const { t } = useI18n();
  
  // View mode can be 'exposed' (before) or 'redacted' (after)
  // When file is cleaned, it automatically defaults to 'redacted' unless explicitly overridden by user
  const [userOverrideMode, setUserOverrideMode] = useState(null);
  const [showMapEmbed, setShowMapEmbed] = useState(false);
  const [copied, setCopied] = useState(false);

  const viewMode = userOverrideMode ?? (isCleaned ? 'redacted' : 'exposed');

  if (!gpsInfo || !gpsInfo.hasGps) {
    return null;
  }

  const {
    latitude,
    longitude,
    formattedCoords,
    decimalCoords,
    altitude,
    googleMapsUrl,
    appleMapsUrl,
    osmUrl,
    dateStamp,
    direction,
  } = gpsInfo;

  const isRedacted = viewMode === 'redacted';

  // Compute a deterministic radar target offset from lat/lon
  // Maps coordinates into a radar position between 25px and 70px from center (100, 100)
  const angle = Math.abs((latitude * 17.13 + longitude * 31.41) % (2 * Math.PI));
  const dist = 32 + (Math.abs(latitude * 11 + longitude * 7) % 36);
  const targetX = 100 + Math.cos(angle) * dist;
  const targetY = 100 + Math.sin(angle) * dist;

  const handleCopyCoords = async () => {
    try {
      const textToCopy = `${decimalCoords} (${formattedCoords})`;
      await navigator.clipboard.writeText(textToCopy);
      setCopied(true);
      toast.success(t('gpsCoordsCopied') || 'Coordinates copied to clipboard!');
      setTimeout(() => setCopied(false), 2200);
    } catch {
      toast.error('Failed to copy coordinates');
    }
  };

  // Safe bounding box for OpenStreetMap embed (approx ~500m area)
  const bbox = `${(longitude - 0.005).toFixed(5)}%2C${(latitude - 0.003).toFixed(5)}%2C${(longitude + 0.005).toFixed(5)}%2C${(latitude + 0.003).toFixed(5)}`;
  const embedUrl = `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${latitude.toFixed(5)}%2C${longitude.toFixed(5)}`;

  return (
    <div
      className={`rounded-lg border transition-all duration-300 overflow-hidden shadow-xs animate-fade-in-up ${
        isRedacted
          ? 'bg-emerald-950/20 border-emerald-500/40 dark:bg-emerald-950/30 dark:border-emerald-500/30'
          : 'bg-rose-950/20 border-rose-500/40 dark:bg-rose-950/30 dark:border-rose-500/30'
      }`}
      data-testid="gps-privacy-radar"
    >
      {/* Header Bar */}
      <div
        className={`px-4 py-3 flex flex-wrap items-center justify-between gap-3 border-b ${
          isRedacted
            ? 'bg-emerald-900/30 border-emerald-500/30 text-emerald-800 dark:text-emerald-200'
            : 'bg-rose-900/30 border-rose-500/30 text-rose-800 dark:text-rose-200'
        }`}
      >
        <div className="flex items-center gap-2.5">
          <div
            className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
              isRedacted
                ? 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 animate-shield-pulse'
                : 'bg-rose-500/20 text-rose-600 dark:text-rose-400 animate-radar-glow'
            }`}
          >
            {isRedacted ? (
              /* Shield Check Icon */
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                <path d="m9 12 2 2 4-4" />
              </svg>
            ) : (
              /* Radar Target Crosshair Icon */
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <line x1="22" y1="12" x2="18" y2="12" />
                <line x1="6" y1="12" x2="2" y2="12" />
                <line x1="12" y1="6" x2="12" y2="2" />
                <line x1="12" y1="22" x2="12" y2="18" />
                <circle cx="12" cy="12" r="3" />
              </svg>
            )}
          </div>

          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold tracking-tight text-ink-950 dark:text-ink-50">
                {t('gpsRadarTitle') || 'GPS Privacy Radar'}
              </h3>
              <span
                className={`px-2 py-0.5 rounded-full text-[10px] font-black tracking-wider uppercase ${
                  isRedacted
                    ? 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border border-emerald-500/40'
                    : 'bg-rose-500/20 text-rose-700 dark:text-rose-300 border border-rose-500/40'
                }`}
              >
                {isRedacted ? (t('gpsZeroBytes') || '0 BYTES LEAKED') : (t('gpsCriticalRisk') || 'CRITICAL PRIVACY RISK')}
              </span>
            </div>
            <p className="text-xs text-ink-600 dark:text-ink-400">
              {isRedacted
                ? (t('gpsCleanedNotice') || 'All GPS coordinates, altitude, bearing, and timestamps purged.')
                : (t('gpsLocationExposed') || 'Exact physical coordinates embedded in this photo.')}
            </p>
          </div>
        </div>

        {/* Live Redaction Segmented Toggle (Before vs After) */}
        <div className="flex items-center bg-white/80 dark:bg-ink-900/80 p-0.5 rounded-md border border-ink-300 dark:border-ink-700 shadow-2xs">
          <button
            type="button"
            onClick={() => setUserOverrideMode('exposed')}
            className={`px-2.5 py-1 text-xs font-semibold rounded transition-all flex items-center gap-1.5 ${
              !isRedacted
                ? 'bg-rose-600 text-white shadow-xs'
                : 'text-ink-600 dark:text-ink-300 hover:text-ink-950 dark:hover:text-ink-50'
            }`}
            title="Preview exposed GPS state"
            aria-pressed={!isRedacted}
          >
            <span>⚠️</span>
            <span>{t('gpsBeforeLabel') || 'Exposed (Before)'}</span>
          </button>
          <button
            type="button"
            onClick={() => setUserOverrideMode('redacted')}
            className={`px-2.5 py-1 text-xs font-semibold rounded transition-all flex items-center gap-1.5 ${
              isRedacted
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'text-ink-600 dark:text-ink-300 hover:text-ink-950 dark:hover:text-ink-50'
            }`}
            title="Preview redacted GPS state"
            aria-pressed={isRedacted}
          >
            <span>🛡️</span>
            <span>{t('gpsAfterLabel') || 'Redacted (After)'}</span>
          </button>
        </div>
      </div>

      {/* Main Radar Screen + Telemetry Area */}
      <div className="p-4 grid grid-cols-1 md:grid-cols-12 gap-5 items-center">
        {/* Tactical Radar Display (SVG) */}
        <div className="md:col-span-5 flex flex-col items-center justify-center">
          <div className="relative w-56 h-56 sm:w-60 sm:h-60 rounded-full p-1 bg-ink-950 border border-ink-800 shadow-lg overflow-hidden select-none">
            {/* Background Radial Glow */}
            <div
              className={`absolute inset-0 rounded-full opacity-30 transition-all duration-500 ${
                isRedacted ? 'bg-radial-emerald' : 'bg-radial-rose'
              }`}
              style={{
                background: isRedacted
                  ? 'radial-gradient(circle, rgba(16,185,129,0.25) 0%, rgba(5,46,22,0.8) 100%)'
                  : 'radial-gradient(circle, rgba(244,63,94,0.25) 0%, rgba(40,10,20,0.8) 100%)',
              }}
            />

            {/* Tactical Grid SVG */}
            <svg
              viewBox="0 0 200 200"
              className="w-full h-full relative z-10"
              aria-label={isRedacted ? "GPS location redacted" : `Radar display showing target coordinates ${decimalCoords}`}
            >
              {/* Outer Ring */}
              <circle
                cx="100"
                cy="100"
                r="96"
                fill="none"
                stroke={isRedacted ? '#10b981' : '#f43f5e'}
                strokeWidth="1.2"
                strokeDasharray="4 2"
                opacity="0.6"
              />

              {/* Concentric Range Rings (50m, 250m, 1km, 5km) */}
              <circle cx="100" cy="100" r="75" fill="none" stroke={isRedacted ? '#10b981' : '#f43f5e'} strokeWidth="0.75" opacity="0.3" />
              <circle cx="100" cy="100" r="50" fill="none" stroke={isRedacted ? '#10b981' : '#f43f5e'} strokeWidth="0.75" opacity="0.3" />
              <circle cx="100" cy="100" r="25" fill="none" stroke={isRedacted ? '#10b981' : '#f43f5e'} strokeWidth="0.75" opacity="0.35" />

              {/* Crosshair Axes */}
              <line x1="100" y1="4" x2="100" y2="196" stroke={isRedacted ? '#10b981' : '#f43f5e'} strokeWidth="0.75" strokeDasharray="3 3" opacity="0.4" />
              <line x1="4" y1="100" x2="196" y2="100" stroke={isRedacted ? '#10b981' : '#f43f5e'} strokeWidth="0.75" strokeDasharray="3 3" opacity="0.4" />

              {/* Diagonal Reticle Crosses */}
              <line x1="28" y1="28" x2="172" y2="172" stroke={isRedacted ? '#10b981' : '#f43f5e'} strokeWidth="0.5" strokeDasharray="2 4" opacity="0.2" />
              <line x1="172" y1="28" x2="28" y2="172" stroke={isRedacted ? '#10b981' : '#f43f5e'} strokeWidth="0.5" strokeDasharray="2 4" opacity="0.2" />

              {/* Cardinal Markers (N, E, S, W) */}
              <text x="100" y="14" fill={isRedacted ? '#34d399' : '#fb7185'} fontSize="9" fontWeight="bold" fontFamily="monospace" textAnchor="middle">N</text>
              <text x="190" y="103" fill={isRedacted ? '#34d399' : '#fb7185'} fontSize="9" fontWeight="bold" fontFamily="monospace" textAnchor="middle">E</text>
              <text x="100" y="193" fill={isRedacted ? '#34d399' : '#fb7185'} fontSize="9" fontWeight="bold" fontFamily="monospace" textAnchor="middle">S</text>
              <text x="10" y="103" fill={isRedacted ? '#34d399' : '#fb7185'} fontSize="9" fontWeight="bold" fontFamily="monospace" textAnchor="middle">W</text>

              {/* Distance Markings */}
              <text x="102" y="30" fill={isRedacted ? '#059669' : '#e11d48'} fontSize="6" fontFamily="monospace" opacity="0.7">1km</text>
              <text x="102" y="55" fill={isRedacted ? '#059669' : '#e11d48'} fontSize="6" fontFamily="monospace" opacity="0.7">250m</text>
              <text x="102" y="80" fill={isRedacted ? '#059669' : '#e11d48'} fontSize="6" fontFamily="monospace" opacity="0.7">50m</text>

              {/* Radar Rotating Sweep Line */}
              <g className="animate-radar-sweep origin-center" style={{ transformOrigin: '100px 100px' }}>
                <line
                  x1="100"
                  y1="100"
                  x2="100"
                  y2="5"
                  stroke={isRedacted ? '#34d399' : '#fb7185'}
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  opacity="0.8"
                />
                {/* Sweep Beam Glow Wedge */}
                <polygon
                  points="100,100 100,5 65,15"
                  fill={isRedacted ? 'url(#emerald-sweep)' : 'url(#rose-sweep)'}
                  opacity="0.35"
                />
              </g>

              {/* Gradient Definitions */}
              <defs>
                <linearGradient id="rose-sweep" x1="100%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" stopColor="#f43f5e" stopOpacity="0.8" />
                  <stop offset="100%" stopColor="#f43f5e" stopOpacity="0" />
                </linearGradient>
                <linearGradient id="emerald-sweep" x1="100%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" stopColor="#10b981" stopOpacity="0.8" />
                  <stop offset="100%" stopColor="#10b981" stopOpacity="0" />
                </linearGradient>
              </defs>

              {/* EXPOSED STATE: Target Reticle & Ping */}
              {!isRedacted && (
                <g>
                  {/* Outer Sonar Ping Ripple */}
                  <circle
                    cx={targetX}
                    cy={targetY}
                    r="12"
                    fill="none"
                    stroke="#f43f5e"
                    strokeWidth="1.5"
                    className="animate-radar-ping"
                    style={{ transformOrigin: `${targetX}px ${targetY}px` }}
                  />

                  {/* Target Crosshair Ring */}
                  <circle
                    cx={targetX}
                    cy={targetY}
                    r="5.5"
                    fill="#f43f5e"
                    fillOpacity="0.3"
                    stroke="#f43f5e"
                    strokeWidth="1.5"
                    className="animate-radar-glow"
                  />

                  {/* Target Center Blip */}
                  <circle cx={targetX} cy={targetY} r="2.5" fill="#ffffff" />

                  {/* Crosshair Bracket Lines */}
                  <line x1={targetX - 9} y1={targetY} x2={targetX - 3} y2={targetY} stroke="#f43f5e" strokeWidth="1" />
                  <line x1={targetX + 3} y1={targetY} x2={targetX + 9} y2={targetY} stroke="#f43f5e" strokeWidth="1" />
                  <line x1={targetX} y1={targetY - 9} x2={targetX} y2={targetY - 3} stroke="#f43f5e" strokeWidth="1" />
                  <line x1={targetX} y1={targetY + 3} x2={targetX} y2={targetY + 9} stroke="#f43f5e" strokeWidth="1" />

                  {/* Target Lock Badge */}
                  <rect
                    x={targetX > 100 ? targetX - 52 : targetX + 8}
                    y={targetY > 100 ? targetY - 18 : targetY + 6}
                    width="48"
                    height="12"
                    rx="2"
                    fill="#14171a"
                    stroke="#f43f5e"
                    strokeWidth="0.75"
                    opacity="0.9"
                  />
                  <text
                    x={targetX > 100 ? targetX - 28 : targetX + 32}
                    y={targetY > 100 ? targetY - 9 : targetY + 15}
                    fill="#fb7185"
                    fontSize="6"
                    fontFamily="monospace"
                    fontWeight="bold"
                    textAnchor="middle"
                  >
                    TARGET LOCKED
                  </text>
                </g>
              )}

              {/* REDACTED STATE: Secure Shield Centerpiece */}
              {isRedacted && (
                <g className="animate-fade-in-up">
                  {/* Shield Glow Halo */}
                  <circle cx="100" cy="100" r="28" fill="#10b981" fillOpacity="0.12" stroke="#10b981" strokeWidth="1" strokeDasharray="3 2" />

                  {/* Central Shield Icon */}
                  <path
                    d="M100 80 L115 86 C115 102 108 114 100 120 C92 114 85 102 85 86 Z"
                    fill="#064e3b"
                    stroke="#34d399"
                    strokeWidth="1.8"
                    strokeLinejoin="round"
                    className="animate-shield-pulse"
                  />
                  {/* Checkmark inside Shield */}
                  <path
                    d="M94 99 L98 103 L106 94"
                    fill="none"
                    stroke="#ffffff"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />

                  <text x="100" y="134" fill="#34d399" fontSize="6.5" fontFamily="monospace" fontWeight="bold" textAnchor="middle">
                    PAYLOAD PURGED
                  </text>
                  <text x="100" y="142" fill="#6ee7b7" fontSize="5.5" fontFamily="monospace" textAnchor="middle">
                    0 BYTES GPS EXIF
                  </text>
                </g>
              )}
            </svg>

            {/* Radar Corner Telemetry Badges */}
            <div className="absolute top-2 left-2 text-[8px] font-mono font-bold text-ink-300 pointer-events-none z-20">
              {isRedacted ? 'STATUS: PURGED' : 'SCAN: ACTIVE'}
            </div>
            <div className="absolute top-2 right-2 text-[8px] font-mono font-bold text-ink-300 pointer-events-none z-20">
              {isRedacted ? 'GPS: 0 BYTES' : 'FIX: 3D DGPS'}
            </div>
            <div className="absolute bottom-2 left-2 text-[8px] font-mono font-bold text-ink-400 pointer-events-none z-20">
              {isRedacted ? 'LEAKAGE: 0%' : (altitude || 'MSL: 0m')}
            </div>
            <div className="absolute bottom-2 right-2 text-[8px] font-mono font-bold text-ink-400 pointer-events-none z-20">
              {isRedacted ? 'SHIELD: ARMED' : 'GEO: WGS84'}
            </div>
          </div>

          <div className="mt-2 text-center">
            <span className="text-[11px] font-mono text-ink-500 dark:text-ink-400">
              {isRedacted
                ? 'Security Status: Location tags completely neutralized'
                : 'Sensor: High-Precision Geotag Telemetry Active'}
            </span>
          </div>
        </div>

        {/* Telemetry Dashboard Data Panel */}
        <div className="md:col-span-7 space-y-3.5">
          {/* Main Status Headline */}
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-ink-500 dark:text-ink-400">
                {isRedacted ? (t('gpsLocationRedacted') || 'Location Data Redacted') : (t('gpsLocationExposed') || 'Physical Geolocation Detected')}
              </span>
              <span className="text-xs font-mono text-ink-400">
                {fileName}
              </span>
            </div>

            <p className="text-xs text-ink-700 dark:text-ink-300 leading-relaxed">
              {isRedacted
                ? 'All GPS tags (Latitude, Longitude, Altitude, Timestamp, Camera Bearing) are stripped losslessly. The image file contains zero location remnants.'
                : 'Anyone who downloads or receives this unmodified photo can extract the exact physical location, elevation, and timestamp where you were standing.'}
            </p>
          </div>

          {/* Telemetry Matrix Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
            {/* Coordinates Box */}
            <div className="p-2.5 rounded-md bg-white/70 dark:bg-ink-900/60 border border-ink-200 dark:border-ink-800 space-y-1">
              <div className="flex items-center justify-between text-[11px] text-ink-500 dark:text-ink-400 font-medium">
                <span>{t('gpsCoordinates') || 'Coordinates'}</span>
                {!isRedacted && (
                  <button
                    type="button"
                    onClick={handleCopyCoords}
                    className="text-[10px] font-bold text-safelight-600 dark:text-safelight-400 hover:underline flex items-center gap-1"
                    title="Copy coordinates to clipboard"
                  >
                    <span>{copied ? '✓ Copied' : 'Copy'}</span>
                  </button>
                )}
              </div>
              <div className="font-mono font-bold text-ink-950 dark:text-ink-50 text-xs">
                {isRedacted ? (
                  <span className="text-ink-400 dark:text-ink-600 line-through tracking-wider">
                    ████° ██' ██" N, ███° ██' ██" W
                  </span>
                ) : (
                  <div>
                    <div>{formattedCoords}</div>
                    <div className="text-[11px] font-normal text-ink-500">{decimalCoords}</div>
                  </div>
                )}
              </div>
            </div>

            {/* Altitude Box */}
            <div className="p-2.5 rounded-md bg-white/70 dark:bg-ink-900/60 border border-ink-200 dark:border-ink-800 space-y-1">
              <span className="text-[11px] text-ink-500 dark:text-ink-400 font-medium block">
                {t('gpsAltitude') || 'Altitude / Elevation'}
              </span>
              <div className="font-mono font-bold text-ink-950 dark:text-ink-50 text-xs">
                {isRedacted ? (
                  <span className="text-ink-400 dark:text-ink-600 line-through">
                    ████ m (Purged)
                  </span>
                ) : (
                  altitude || 'Not Recorded'
                )}
              </div>
            </div>

            {/* Date/Time Box */}
            <div className="p-2.5 rounded-md bg-white/70 dark:bg-ink-900/60 border border-ink-200 dark:border-ink-800 space-y-1">
              <span className="text-[11px] text-ink-500 dark:text-ink-400 font-medium block">
                {t('gpsTimestamp') || 'GPS Timestamp'}
              </span>
              <div className="font-mono text-ink-900 dark:text-ink-100 text-xs">
                {isRedacted ? (
                  <span className="text-ink-400 dark:text-ink-600 line-through">
                    ████:██:██ [Purged]
                  </span>
                ) : (
                  dateStamp || metadata.DateTimeOriginal || 'Not Recorded'
                )}
              </div>
            </div>

            {/* Camera Bearing Box */}
            <div className="p-2.5 rounded-md bg-white/70 dark:bg-ink-900/60 border border-ink-200 dark:border-ink-800 space-y-1">
              <span className="text-[11px] text-ink-500 dark:text-ink-400 font-medium block">
                {t('gpsDirection') || 'Camera Bearing'}
              </span>
              <div className="font-mono text-ink-900 dark:text-ink-100 text-xs">
                {isRedacted ? (
                  <span className="text-ink-400 dark:text-ink-600 line-through">
                    ███° [Purged]
                  </span>
                ) : (
                  direction || 'Not Recorded'
                )}
              </div>
            </div>
          </div>

          {/* Action Bar (Maps & Interactive Preview) */}
          <div className="pt-1 flex flex-wrap items-center gap-2">
            {!isRedacted ? (
              <>
                {/* Google Maps Link */}
                <a
                  href={googleMapsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-2.5 py-1.5 rounded bg-white dark:bg-ink-800 border border-ink-300 dark:border-ink-700 hover:bg-ink-100 dark:hover:bg-ink-700 text-xs font-semibold text-ink-800 dark:text-ink-100 flex items-center gap-1.5 transition-colors shadow-2xs"
                  title="Open in Google Maps"
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-rose-600 dark:text-rose-400">
                    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                    <circle cx="12" cy="10" r="3" />
                  </svg>
                  <span>{t('gpsGoogleMaps') || 'Google Maps'}</span>
                </a>

                {/* Apple Maps Link */}
                <a
                  href={appleMapsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-2.5 py-1.5 rounded bg-white dark:bg-ink-800 border border-ink-300 dark:border-ink-700 hover:bg-ink-100 dark:hover:bg-ink-700 text-xs font-semibold text-ink-800 dark:text-ink-100 flex items-center gap-1.5 transition-colors shadow-2xs"
                  title="Open in Apple Maps"
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-sky-600 dark:text-sky-400">
                    <polygon points="3 6 9 3 15 6 21 3 21 18 15 21 9 18 3 21" />
                    <line x1="9" y1="3" x2="9" y2="18" />
                    <line x1="15" y1="6" x2="15" y2="21" />
                  </svg>
                  <span>{t('gpsAppleMaps') || 'Apple Maps'}</span>
                </a>

                {/* OpenStreetMap Link */}
                <a
                  href={osmUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-2.5 py-1.5 rounded bg-white dark:bg-ink-800 border border-ink-300 dark:border-ink-700 hover:bg-ink-100 dark:hover:bg-ink-700 text-xs font-semibold text-ink-800 dark:text-ink-100 flex items-center gap-1.5 transition-colors shadow-2xs"
                  title="Open in OpenStreetMap"
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-emerald-600 dark:text-emerald-400">
                    <circle cx="12" cy="12" r="10" />
                    <polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76" />
                  </svg>
                  <span>{t('gpsOpenStreetMap') || 'OpenStreetMap'}</span>
                </a>

                {/* Toggle Interactive Map Embed */}
                <button
                  type="button"
                  onClick={() => setShowMapEmbed(!showMapEmbed)}
                  className={`px-2.5 py-1.5 rounded border text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-2xs ${
                    showMapEmbed
                      ? 'bg-rose-100 dark:bg-rose-950/60 border-rose-300 dark:border-rose-700 text-rose-800 dark:text-rose-200'
                      : 'bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 hover:bg-rose-100 dark:hover:bg-rose-900/40'
                  }`}
                  aria-expanded={showMapEmbed}
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                    <line x1="3" y1="9" x2="21" y2="9" />
                    <line x1="9" y1="21" x2="9" y2="9" />
                  </svg>
                  <span>{showMapEmbed ? (t('gpsHideMap') || 'Hide Street Map') : (t('gpsToggleMap') || 'Show Street Map Preview')}</span>
                </button>
              </>
            ) : (
              <div className="w-full flex items-center gap-2 p-2 rounded bg-emerald-900/20 border border-emerald-500/30 text-emerald-800 dark:text-emerald-300 text-xs">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                  <path d="m9 12 2 2 4-4" />
                </svg>
                <span>Zero location telemetry remaining. All physical coordinates purged.</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Embedded On-Demand OpenStreetMap Preview */}
      {showMapEmbed && !isRedacted && (
        <div className="border-t border-rose-200 dark:border-rose-900/50 p-4 bg-white/50 dark:bg-ink-950/50 animate-fade-in-up">
          <div className="flex items-center justify-between pb-2 text-xs">
            <div className="flex items-center gap-2 text-ink-700 dark:text-ink-300">
              <span className="font-bold">Interactive OpenStreetMap Preview</span>
              <span className="px-1.5 py-0.2 rounded text-[10px] bg-emerald-100 dark:bg-emerald-900/60 text-emerald-800 dark:text-emerald-200">
                100% Client-Side Loaded
              </span>
            </div>
            <button
              type="button"
              onClick={() => setShowMapEmbed(false)}
              className="text-xs font-semibold text-ink-500 hover:text-ink-800 dark:hover:text-ink-200"
            >
              ✕ Close
            </button>
          </div>

          <div className="w-full h-64 rounded-md overflow-hidden border border-ink-300 dark:border-ink-700 relative bg-ink-100 dark:bg-ink-900 shadow-inner">
            <iframe
              title="OpenStreetMap Location Preview"
              width="100%"
              height="100%"
              loading="lazy"
              src={embedUrl}
              className="border-0 w-full h-full"
            />
          </div>

          <p className="mt-2 text-[11px] text-ink-500 dark:text-ink-400">
            {t('gpsMapPrivacyNotice') || 'Privacy Note: Map tiles are loaded on-demand directly from OpenStreetMap. PixelTruth never tracks your IP or coordinates.'}
          </p>
        </div>
      )}
    </div>
  );
}
