import { useState } from 'react';
import PrivacyBadge from './PrivacyBadge';
import MetadataTable from './MetadataTable';

function formatFileSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function FileQueue({ files, onRemoveFile, onToggleTag }) {
  const [expandedId, setExpandedId] = useState(null);

  if (files.length === 0) return null;

  return (
    <div className="glass-card overflow-hidden animate-fade-in-up">
      {/* Queue header */}
      <div className="px-4 sm:px-6 py-4 border-b border-surface-200/60 dark:border-surface-700/40 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-semibold text-surface-800 dark:text-surface-200">
            File Queue
          </h2>
          <span className="px-2 py-0.5 rounded-full bg-accent-100 dark:bg-accent-900/30 text-accent-700 dark:text-accent-400 text-xs font-bold">
            {files.length}
          </span>
        </div>
        <p className="text-xs text-surface-400 dark:text-surface-500">
          Click a row to inspect metadata
        </p>
      </div>

      {/* File rows */}
      <div className="divide-y divide-surface-100 dark:divide-surface-800">
        {files.map((item) => (
          <FileRow
            key={item.id}
            item={item}
            isExpanded={expandedId === item.id}
            onToggleExpand={() =>
              setExpandedId(expandedId === item.id ? null : item.id)
            }
            onRemove={() => onRemoveFile(item.id)}
            onToggleTag={(tag) => onToggleTag(item.id, tag)}
          />
        ))}
      </div>
    </div>
  );
}

function FileRow({ item, isExpanded, onToggleExpand, onRemove, onToggleTag }) {
  const isJpeg = item.file.type === 'image/jpeg';
  const metadataLoading = item.metadata === null;
  const tagCount = item.metadata ? Object.keys(item.metadata).length : 0;

  return (
    <div className="group">
      {/* Main row */}
      <div
        className={`flex items-center gap-3 sm:gap-4 px-4 sm:px-6 py-3 cursor-pointer transition-colors hover:bg-surface-50 dark:hover:bg-surface-800/30 ${
          isExpanded ? 'bg-surface-50 dark:bg-surface-800/20' : ''
        }`}
        onClick={onToggleExpand}
      >
        {/* Thumbnail */}
        <div className="flex-shrink-0 w-12 h-12 rounded-xl overflow-hidden bg-surface-100 dark:bg-surface-700 ring-1 ring-surface-200 dark:ring-surface-600">
          <img
            src={item.thumbnailUrl}
            alt={item.file.name}
            className="w-full h-full object-cover"
            loading="lazy"
          />
        </div>

        {/* File info */}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-surface-800 dark:text-surface-200 truncate">
            {item.file.name}
          </p>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-xs text-surface-400 dark:text-surface-500">
              {formatFileSize(item.file.size)}
            </span>
            {tagCount > 0 && (
              <span className="text-xs text-surface-400 dark:text-surface-500">
                · {tagCount} tags
              </span>
            )}
            {!isJpeg && (
              <span className="text-xs text-surface-400 dark:text-surface-500">
                · {item.file.type.split('/')[1].toUpperCase()}
              </span>
            )}
          </div>
        </div>

        {/* Privacy badge */}
        <div className="hidden sm:block flex-shrink-0">
          {metadataLoading ? (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-surface-100 text-surface-400 dark:bg-surface-700 dark:text-surface-500">
              <span className="w-3 h-3 rounded-full border-2 border-surface-300 border-t-accent-500 animate-spin" />
              Scanning…
            </span>
          ) : (
            <PrivacyBadge level={item.privacyLevel} />
          )}
        </div>

        {/* Expand arrow */}
        <div className="flex-shrink-0">
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={`text-surface-400 transition-transform duration-200 ${
              isExpanded ? 'rotate-180' : ''
            }`}
          >
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </div>

        {/* Remove button */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          className="flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center text-surface-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors opacity-0 group-hover:opacity-100"
          aria-label={`Remove ${item.file.name}`}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>

      {/* Mobile badge row */}
      <div className="sm:hidden px-4 pb-2 -mt-1">
        {metadataLoading ? (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-surface-100 text-surface-400 dark:bg-surface-700 dark:text-surface-500">
            <span className="w-3 h-3 rounded-full border-2 border-surface-300 border-t-accent-500 animate-spin" />
            Scanning…
          </span>
        ) : (
          <PrivacyBadge level={item.privacyLevel} />
        )}
      </div>

      {/* Expanded metadata table */}
      {isExpanded && item.metadata && (
        <div className="border-t border-surface-100 dark:border-surface-800 bg-surface-50/50 dark:bg-surface-900/20">
          <MetadataTable
            metadata={item.metadata}
            keepTags={item.keepTags}
            onToggleTag={onToggleTag}
            isJpeg={isJpeg}
          />
        </div>
      )}
    </div>
  );
}
