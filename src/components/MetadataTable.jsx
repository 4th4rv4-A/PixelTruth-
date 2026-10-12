import { useState } from 'react';
import { isTagAlwaysKept } from '../utils/readMetadata';

/**
 * Format metadata values for display.
 */
function formatValue(value) {
  if (value === undefined || value === null) return '—';
  if (value instanceof Date) return value.toLocaleString();
  if (typeof value === 'object') {
    try {
      return JSON.stringify(value);
    } catch {
      return String(value);
    }
  }
  if (typeof value === 'number') {
    // GPS coordinates: show 6 decimal places
    if (Math.abs(value) < 200 && value % 1 !== 0) {
      return value.toFixed(6);
    }
    return value.toString();
  }
  return String(value);
}

/**
 * Human-friendly formatting for JFIF header tags (as shown by exifremover.com).
 * Returns null when no special formatting applies.
 */
function formatJfif(key, value) {
  if (key === 'JFIFVersion' && typeof value === 'number') {
    const major = (value >> 8) & 0xff;
    const minor = value & 0xff;
    return `${major}.${String(minor).padStart(2, '0')}`; // 257 -> "1.01"
  }
  if (key === 'ResolutionUnit' && typeof value === 'number') {
    return ['None', 'inches', 'cm'][value] ?? String(value); // 0 -> "None"
  }
  return null;
}

/**
 * Categorize tags for display grouping.
 */
function categorize(key) {
  const gps = ['latitude', 'longitude', 'GPSLatitude', 'GPSLongitude', 'GPSAltitude', 'GPSDateStamp', 'GPSTimeStamp', 'GPSImgDirection'];
  const device = ['Make', 'Model', 'LensMake', 'LensModel', 'Software', 'HostComputer', 'SerialNumber', 'LensSerialNumber'];
  const datetime = ['DateTimeOriginal', 'DateTimeDigitized', 'CreateDate', 'ModifyDate', 'DateTime'];
  const personal = ['Artist', 'Copyright', 'OwnerName', 'ImageDescription', 'UserComment'];
  const rendering = ['Orientation', 'ColorSpace', 'ICC_Profile', 'ExifImageWidth', 'ExifImageHeight', 'XResolution', 'YResolution', 'JFIFVersion', 'ResolutionUnit'];

  if (gps.includes(key)) return { group: '📍 GPS / Location', order: 0 };
  if (device.includes(key)) return { group: '📱 Device Info', order: 1 };
  if (datetime.includes(key)) return { group: '📅 Date & Time', order: 2 };
  if (personal.includes(key)) return { group: '👤 Personal / Copyright', order: 3 };
  if (rendering.includes(key)) return { group: '🎨 Rendering', order: 4 };
  return { group: '📋 Other', order: 5 };
}

export default function MetadataTable({ metadata = {}, keepTags = [], onToggleTag, isJpeg, mimeType }) {
  const [searchQuery, setSearchQuery] = useState('');

  const c2paRows = Array.isArray(metadata.__c2pa) ? metadata.__c2pa : [];

  const entries = Object.entries(metadata)
    .filter(([key, value]) => !key.startsWith('__') && value !== undefined && value !== null && value !== '')
    .map(([key, value]) => [key, formatJfif(key, value) ?? value]);

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
    ? entries.filter(([key, value]) => {
        const valStr = formatValue(value).toLowerCase();
        return key.toLowerCase().includes(query) || valStr.includes(query);
      })
    : entries;

  // Group filtered entries by category
  const grouped = {};
  for (const [key, value] of filteredEntries) {
    const { group, order } = categorize(key);
    if (!grouped[group]) grouped[group] = { order, entries: [] };
    grouped[group].entries.push([key, value]);
  }

  const sortedGroups = Object.entries(grouped).sort(([, a], [, b]) => a.order - b.order);

  const effectiveMime = isJpeg ? 'image/jpeg' : (mimeType || 'image/png');
  const isAlwaysKept = (key) => isTagAlwaysKept(key, effectiveMime);

  return (
    <div className="animate-fade-in-up space-y-2">
      {!isJpeg && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 text-xs">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="16" x2="12" y2="12" />
            <line x1="12" y1="8" x2="12.01" y2="8" />
          </svg>
          Orientation and selective tag removal are preserved for JPEG only. For other formats, color profiles are preserved and EXIF metadata is stripped.
        </div>
      )}

      {/* Search Input Box */}
      <div className="relative">
        <input
          type="search"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Filter metadata tags (e.g. GPS, Date, Make, Camera)..."
          aria-label="Filter metadata tags by name or value"
          className="w-full pl-9 pr-9 py-2 text-xs rounded-md bg-white dark:bg-ink-900 border border-ink-300 dark:border-ink-700 text-ink-900 dark:text-ink-100 placeholder-ink-400 focus:outline-none focus:ring-2 focus:ring-safelight-500 shadow-sm"
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
            className="absolute right-3 top-2 text-xs text-ink-400 hover:text-ink-700 dark:hover:text-ink-200"
            aria-label="Clear search query"
          >
            ✕
          </button>
        )}
      </div>

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

      {filteredEntries.length === 0 ? (
        <div className="px-4 py-8 text-center text-sm text-ink-400 dark:text-ink-500 frame">
          No metadata tags matching &ldquo;{searchQuery}&rdquo;.
        </div>
      ) : (
        <div className="overflow-x-auto frame">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-ink-300 dark:border-ink-700">
                <th className="text-left px-4 py-2.5 text-xs font-semibold text-ink-500 dark:text-ink-400 uppercase tracking-wider w-10">
                  Keep
                </th>
                <th className="text-left px-4 py-2.5 text-xs font-semibold text-ink-500 dark:text-ink-400 uppercase tracking-wider">
                  Tag
                </th>
                <th className="text-left px-4 py-2.5 text-xs font-semibold text-ink-500 dark:text-ink-400 uppercase tracking-wider">
                  Value
                </th>
                <th className="text-left px-4 py-2.5 text-xs font-semibold text-ink-500 dark:text-ink-400 uppercase tracking-wider w-36">
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
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function GroupRows({ group, entries, keepTags, onToggleTag, isJpeg, isAlwaysKept }) {
  return (
    <>
      <tr>
        <td
          colSpan={4}
          className="px-4 pt-4 pb-1.5 text-xs font-bold text-ink-600 dark:text-ink-300 bg-ink-100 dark:bg-ink-800"
        >
          {group}
        </td>
      </tr>
      {entries.map(([key, value]) => {
        const alwaysKept = isAlwaysKept(key);
        const kept = alwaysKept || keepTags.includes(key);
        const checkboxDisabled = alwaysKept || !isJpeg;

        return (
          <tr
            key={key}
            className="border-b border-ink-200 dark:border-ink-800 hover:bg-ink-50 dark:hover:bg-ink-900/50 transition-colors"
          >
            <td className="px-4 py-2.5 text-center">
              <input
                type="checkbox"
                checked={kept}
                disabled={checkboxDisabled}
                onChange={() => onToggleTag?.(key)}
                aria-label={`Keep ${key}`}
                className="w-4 h-4 rounded-sm border-ink-400 dark:border-ink-600 text-safelight-600 focus:ring-safelight-500 focus:ring-offset-0 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
              />
            </td>
            <td className="px-4 py-2.5 font-mono text-xs text-ink-700 dark:text-ink-300">
              {key}
            </td>
            <td className="px-4 py-2.5 text-ink-600 dark:text-ink-400 max-w-xs truncate" title={formatValue(value)}>
              {formatValue(value)}
            </td>
            <td className="px-4 py-2.5">
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
