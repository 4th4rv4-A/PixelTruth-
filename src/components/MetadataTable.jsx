import { useState, useMemo } from 'react';
import toast from 'react-hot-toast';
import { isTagAlwaysKept, getDetailedPrivacyReport } from '../utils/readMetadata';
import {
  formatTagValue,
  extractGpsInfo,
  exportMetadataToJson,
  formatMetadataForClipboard,
} from '../utils/metadataFormatter';

/**
 * Categorize tags for display grouping.
 */
function categorize(key) {
  const gps = ['latitude', 'longitude', 'GPSLatitude', 'GPSLongitude', 'GPSAltitude', 'GPSDateStamp', 'GPSTimeStamp', 'GPSImgDirection', 'GPSDestLatitude', 'GPSDestLongitude'];
  const device = ['Make', 'Model', 'LensMake', 'LensModel', 'Software', 'HostComputer', 'SerialNumber', 'LensSerialNumber', 'BodySerialNumber', 'CameraOwnerName'];
  const datetime = ['DateTimeOriginal', 'DateTimeDigitized', 'CreateDate', 'ModifyDate', 'DateTime', 'OffsetTime', 'OffsetTimeOriginal', 'SubSecTimeOriginal'];
  const personal = ['Artist', 'Copyright', 'OwnerName', 'ImageDescription', 'UserComment', 'XPAuthor', 'XPComment', 'XPTitle'];
  const rendering = ['Orientation', 'ColorSpace', 'ICC_Profile', 'ExifImageWidth', 'ExifImageHeight', 'XResolution', 'YResolution', 'JFIFVersion', 'ResolutionUnit', 'PixelXDimension', 'PixelYDimension'];

  if (gps.includes(key)) return { group: '📍 GPS / Geolocation', order: 0 };
  if (device.includes(key)) return { group: '📱 Camera & Device Info', order: 1 };
  if (datetime.includes(key)) return { group: '📅 Date & Time', order: 2 };
  if (personal.includes(key)) return { group: '👤 Personal & Creator', order: 3 };
  if (rendering.includes(key)) return { group: '🎨 Color & Rendering', order: 4 };
  return { group: '📋 Technical & Exposure', order: 5 };
}

export default function MetadataTable({
  metadata = {},
  keepTags = [],
  onToggleTag,
  isJpeg,
  mimeType,
  fileName = 'image',
}) {
  const [searchQuery, setSearchQuery] = useState('');
  const [copiedKey, setCopiedKey] = useState(null);

  const c2paRows = Array.isArray(metadata.__c2pa) ? metadata.__c2pa : [];

  const entries = useMemo(() => {
    return Object.entries(metadata)
      .filter(([key, value]) => !key.startsWith('__') && value !== undefined && value !== null && value !== '')
      .map(([key, value]) => [key, value, formatTagValue(key, value)]);
  }, [metadata]);

  const gpsInfo = useMemo(() => extractGpsInfo(metadata), [metadata]);
  const privacyReport = useMemo(() => getDetailedPrivacyReport(metadata), [metadata]);

  const handleCopyValue = (key, formattedVal) => {
    navigator.clipboard.writeText(formattedVal);
    setCopiedKey(key);
    toast.success(`Copied "${key}" to clipboard!`);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const handleCopyAll = () => {
    const text = formatMetadataForClipboard(fileName, metadata);
    navigator.clipboard.writeText(text);
    toast.success('All metadata copied to clipboard!');
  };

  const handleExportJson = () => {
    exportMetadataToJson(fileName, metadata);
    toast.success('Metadata JSON exported!');
  };

  if (entries.length === 0 && c2paRows.length === 0) {
    return (
      <div className="px-4 py-8 text-center text-sm text-ink-400 dark:text-ink-500 frame">
        No metadata found in this file.
      </div>
    );
  }

  // Filter entries based on search query
  const query = searchQuery.toLowerCase().trim();
  const filteredEntries = query
    ? entries.filter(([key, rawVal, formattedVal]) => {
        return (
          key.toLowerCase().includes(query) ||
          String(rawVal).toLowerCase().includes(query) ||
          formattedVal.toLowerCase().includes(query)
        );
      })
    : entries;

  // Group filtered entries by category
  const grouped = {};
  for (const [key, rawVal, formattedVal] of filteredEntries) {
    const { group, order } = categorize(key);
    if (!grouped[group]) grouped[group] = { order, entries: [] };
    grouped[group].entries.push([key, rawVal, formattedVal]);
  }

  const sortedGroups = Object.entries(grouped).sort(([, a], [, b]) => a.order - b.order);
  const effectiveMime = isJpeg ? 'image/jpeg' : (mimeType || 'image/png');
  const isAlwaysKept = (key) => isTagAlwaysKept(key, effectiveMime);

  return (
    <div className="animate-fade-in-up space-y-3">
      {/* Format Notice */}
      {!isJpeg && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-md bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 text-xs border border-amber-200 dark:border-amber-800/40">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="16" x2="12" y2="12" />
            <line x1="12" y1="8" x2="12.01" y2="8" />
          </svg>
          Orientation and selective tag removal are preserved for JPEG only. For other formats, color profiles are preserved and EXIF metadata is stripped losslessly.
        </div>
      )}

      {/* GPS Location Alert & Map Card */}
      {gpsInfo.hasGps && (
        <div className="p-3.5 rounded-md bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/50 flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-fade-in-up">
          <div className="flex items-start gap-2.5">
            <div className="w-7 h-7 rounded-full bg-rose-100 dark:bg-rose-900/50 flex items-center justify-center text-rose-600 dark:text-rose-400 shrink-0 mt-0.5">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                <circle cx="12" cy="10" r="3" />
              </svg>
            </div>
            <div className="space-y-0.5">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-rose-800 dark:text-rose-300">
                  Exact Physical Location Exposed
                </span>
                <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-rose-200 dark:bg-rose-900 text-rose-800 dark:text-rose-200">
                  CRITICAL PRIVACY RISK
                </span>
              </div>
              <p className="text-xs font-mono text-rose-900 dark:text-rose-200 font-medium">
                {gpsInfo.formattedCoords}
                {gpsInfo.altitude && ` • ${gpsInfo.altitude}`}
              </p>
            </div>
          </div>

          <a
            href={gpsInfo.mapUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="px-3 py-1.5 rounded-md bg-white dark:bg-ink-800 border border-rose-300 dark:border-rose-800 text-rose-700 dark:text-rose-300 hover:bg-rose-50 dark:hover:bg-rose-900/40 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors shadow-xs shrink-0"
            title="Open coordinates in OpenStreetMap in a new tab"
          >
            <span>View on Map</span>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
              <polyline points="15 3 21 3 21 9" />
              <line x1="10" y1="14" x2="21" y2="3" />
            </svg>
          </a>
        </div>
      )}

      {/* Privacy Risk Breakdown Diagnostic */}
      {privacyReport.risks.length > 0 && !gpsInfo.hasGps && (
        <div className="p-3 rounded-md bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/40 text-xs flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="text-amber-600 dark:text-amber-400 font-bold">⚠️ Privacy Signals:</span>
            <span className="text-ink-700 dark:text-ink-300">
              {privacyReport.risks.map((r) => r.category).join(' • ')}
            </span>
          </div>
          <span className="px-2 py-0.5 rounded bg-amber-200 dark:bg-amber-900/60 text-amber-800 dark:text-amber-300 text-[11px] font-bold shrink-0">
            {privacyReport.score}% Risk
          </span>
        </div>
      )}

      {/* Search Input Box & Action Controls */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
        <div className="relative flex-1">
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                setSearchQuery('');
              }
            }}
            placeholder="Filter metadata tags (e.g. GPS, Date, Make, Camera, ISO)..."
            aria-label="Filter metadata tags by name or value"
            className="w-full pl-9 pr-9 py-2 text-xs rounded-md bg-white dark:bg-ink-900 border border-ink-300 dark:border-ink-700 text-ink-900 dark:text-ink-100 placeholder-ink-400 focus:outline-none focus:ring-2 focus:ring-safelight-500 shadow-xs"
          />
          <svg
            className="absolute left-3 top-2.5 w-3.5 h-3.5 text-ink-400 pointer-events-none"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-2 text-xs text-ink-400 hover:text-ink-700 dark:hover:text-ink-200 cursor-pointer"
              aria-label="Clear search query"
            >
              ✕
            </button>
          )}
        </div>

        {/* Action buttons: Copy All & Export JSON */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={handleCopyAll}
            className="px-2.5 py-2 rounded-md bg-ink-100 hover:bg-ink-200 dark:bg-ink-800 dark:hover:bg-ink-700 text-ink-700 dark:text-ink-300 text-xs font-semibold flex items-center gap-1.5 transition-colors border border-ink-300 dark:border-ink-700 shadow-xs cursor-pointer"
            title="Copy formatted metadata summary to clipboard"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect width="14" height="14" x="8" y="8" rx="2" ry="2" />
              <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
            </svg>
            Copy All
          </button>

          <button
            onClick={handleExportJson}
            className="px-2.5 py-2 rounded-md bg-ink-100 hover:bg-ink-200 dark:bg-ink-800 dark:hover:bg-ink-700 text-ink-700 dark:text-ink-300 text-xs font-semibold flex items-center gap-1.5 transition-colors border border-ink-300 dark:border-ink-700 shadow-xs cursor-pointer"
            title="Export full metadata as a JSON file before cleaning"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            Export JSON
          </button>
        </div>
      </div>

      {/* C2PA Manifest Section */}
      {c2paRows.length > 0 && (
        <div className="frame p-4">
          <h3 className="text-xs font-semibold text-violet-600 dark:text-violet-400 uppercase tracking-wider mb-2">
            Content Credentials (C2PA) — cryptographically inspected
          </h3>
          <table className="w-full text-sm">
            <tbody>
              {c2paRows.map(([tag, value], i) => (
                <tr key={i} className="border-b border-ink-200 dark:border-ink-800">
                  <td className="px-2 py-1.5 font-mono text-xs text-ink-700 dark:text-ink-300 align-top whitespace-nowrap pr-4">{tag}</td>
                  <td className="px-2 py-1.5 text-ink-600 dark:text-ink-400 break-all">{value}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Metadata Table */}
      {filteredEntries.length === 0 ? (
        <div className="px-4 py-8 text-center text-sm text-ink-400 dark:text-ink-500 frame">
          No tags found for &ldquo;{searchQuery}&rdquo;.
        </div>
      ) : (
        <div className="overflow-x-auto frame">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-ink-300 dark:border-ink-700">
                <th scope="col" className="text-left px-4 py-2.5 text-xs font-semibold text-ink-500 dark:text-ink-400 uppercase tracking-wider w-10">
                  Keep
                </th>
                <th scope="col" className="text-left px-4 py-2.5 text-xs font-semibold text-ink-500 dark:text-ink-400 uppercase tracking-wider w-44">
                  Tag
                </th>
                <th scope="col" className="text-left px-4 py-2.5 text-xs font-semibold text-ink-500 dark:text-ink-400 uppercase tracking-wider">
                  Value
                </th>
                <th scope="col" className="text-left px-4 py-2.5 text-xs font-semibold text-ink-500 dark:text-ink-400 uppercase tracking-wider w-36">
                  Status
                </th>
              </tr>
            </thead>
            <tbody>
              {sortedGroups.map(([group, { entries: groupEntries }]) => (
                <GroupRows
                  key={group}
                  group={group}
                  entries={groupEntries}
                  keepTags={keepTags}
                  onToggleTag={onToggleTag}
                  isJpeg={isJpeg}
                  isAlwaysKept={isAlwaysKept}
                  copiedKey={copiedKey}
                  onCopyValue={handleCopyValue}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function GroupRows({
  group,
  entries,
  keepTags,
  onToggleTag,
  isJpeg,
  isAlwaysKept,
  copiedKey,
  onCopyValue,
}) {
  return (
    <>
      <tr>
        <td
          colSpan={4}
          className="px-4 pt-3 pb-1.5 text-xs font-bold text-ink-700 dark:text-ink-200 bg-ink-100 dark:bg-ink-800"
        >
          {group}
        </td>
      </tr>
      {entries.map(([key, _rawVal, formattedVal]) => {
        const alwaysKept = isAlwaysKept(key);
        const kept = alwaysKept || keepTags.includes(key);
        const checkboxDisabled = alwaysKept || !isJpeg;
        const isCopied = copiedKey === key;

        return (
          <tr
            key={key}
            className="border-b border-ink-200 dark:border-ink-800 hover:bg-ink-50 dark:hover:bg-ink-900/50 transition-colors group"
          >
            <td className="px-4 py-2 text-center">
              <input
                type="checkbox"
                checked={kept}
                disabled={checkboxDisabled}
                onChange={() => onToggleTag?.(key)}
                aria-label={`Keep ${key}`}
                className="w-4 h-4 rounded-sm border-ink-400 dark:border-ink-600 text-safelight-600 focus:ring-safelight-500 focus:ring-offset-0 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
              />
            </td>
            <td className="px-4 py-2 font-mono text-xs text-ink-700 dark:text-ink-300">
              {key}
            </td>
            <td className="px-4 py-2 text-ink-600 dark:text-ink-300 text-xs">
              <div className="flex items-center justify-between gap-2 max-w-lg">
                <span className="truncate select-all" title={formattedVal}>
                  {formattedVal}
                </span>
                <button
                  type="button"
                  onClick={() => onCopyValue(key, formattedVal)}
                  className="opacity-0 group-hover:opacity-100 focus:opacity-100 px-1.5 py-0.5 rounded text-[11px] text-ink-400 hover:text-ink-700 dark:hover:text-ink-200 transition-opacity cursor-pointer shrink-0"
                  title={`Copy ${key} value`}
                  aria-label={`Copy ${key} value`}
                >
                  {isCopied ? '✓ Copied' : 'Copy'}
                </button>
              </div>
            </td>

            <td className="px-4 py-2">
              {alwaysKept ? (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-sm text-xs font-medium bg-ink-200 text-ink-700 dark:bg-ink-800 dark:text-ink-300">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
                    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                  </svg>
                  Always kept
                </span>
              ) : kept ? (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-sm text-xs font-medium bg-develop-500/20 text-develop-600 dark:text-develop-400">
                  ✓ Keeping
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-sm text-xs font-medium bg-warn-500/20 text-warn-600 dark:text-warn-400">
                  ✕ Will remove
                </span>
              )}
            </td>
          </tr>
        );
      })}
    </>
  );
}
