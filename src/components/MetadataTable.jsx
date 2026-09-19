import { ALWAYS_KEEP_TAGS } from '../utils/readMetadata';

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
 * Categorize tags for display grouping.
 */
function categorize(key) {
  const gps = ['latitude', 'longitude', 'GPSLatitude', 'GPSLongitude', 'GPSAltitude', 'GPSDateStamp', 'GPSTimeStamp', 'GPSImgDirection'];
  const device = ['Make', 'Model', 'LensMake', 'LensModel', 'Software', 'HostComputer', 'SerialNumber', 'LensSerialNumber'];
  const datetime = ['DateTimeOriginal', 'DateTimeDigitized', 'CreateDate', 'ModifyDate', 'DateTime'];
  const personal = ['Artist', 'Copyright', 'OwnerName', 'ImageDescription', 'UserComment'];
  const rendering = ['Orientation', 'ColorSpace', 'ICC_Profile', 'ExifImageWidth', 'ExifImageHeight', 'XResolution', 'YResolution'];

  if (gps.includes(key)) return { group: '📍 GPS / Location', order: 0 };
  if (device.includes(key)) return { group: '📱 Device Info', order: 1 };
  if (datetime.includes(key)) return { group: '📅 Date & Time', order: 2 };
  if (personal.includes(key)) return { group: '👤 Personal / Copyright', order: 3 };
  if (rendering.includes(key)) return { group: '🎨 Rendering', order: 4 };
  return { group: '📋 Other', order: 5 };
}

export default function MetadataTable({ metadata, keepTags, onToggleTag, isJpeg }) {
  const entries = Object.entries(metadata).filter(
    ([, value]) => value !== undefined && value !== null && value !== ''
  );

  if (entries.length === 0) {
    return (
      <div className="px-4 py-6 text-center text-sm text-ink-400 dark:text-ink-500">
        No metadata found in this image.
      </div>
    );
  }

  // Group entries by category
  const grouped = {};
  for (const [key, value] of entries) {
    const { group, order } = categorize(key);
    if (!grouped[group]) grouped[group] = { order, entries: [] };
    grouped[group].entries.push([key, value]);
  }

  const sortedGroups = Object.entries(grouped).sort(([, a], [, b]) => a.order - b.order);

  const isAlwaysKept = (key) => ALWAYS_KEEP_TAGS.includes(key);

  return (
    <div className="animate-fade-in-up">
      {!isJpeg && (
        <div className="mx-4 mt-3 mb-2 flex items-center gap-2 px-3 py-2 rounded-lg bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 text-xs">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="16" x2="12" y2="12" />
            <line x1="12" y1="8" x2="12.01" y2="8" />
          </svg>
          Only full strip available for this format — selective tag removal is JPEG-only.
        </div>
      )}

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
                onChange={() => onToggleTag(key)}
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
