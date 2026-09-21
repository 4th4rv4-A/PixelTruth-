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

  const expandedItem = files.find(f => f.id === expandedId);

  return (
    <div className="animate-fade-in-up flex flex-col gap-2">
      {/* Queue header */}
      <div className="px-1 py-1 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-semibold text-ink-800 dark:text-ink-200">
            File Queue
          </h2>
          <span className="px-2 py-0.5 rounded-sm bg-ink-200 dark:bg-ink-800 text-ink-700 dark:text-ink-300 text-xs font-bold">
            {files.length}
          </span>
        </div>
        <p className="text-xs text-ink-500 dark:text-ink-400">
          Click a frame to inspect metadata
        </p>
      </div>

      {/* Filmstrip */}
      <div className="bg-ink-900 p-2 rounded-sm border border-ink-800">
        <div className="frame-sprocket w-full"></div>
        
        <div className="flex overflow-x-auto gap-4 py-3 snap-x pb-4">
          {files.map((item) => (
            <FileFrame
              key={item.id}
              item={item}
              isExpanded={expandedId === item.id}
              onToggleExpand={() =>
                setExpandedId(expandedId === item.id ? null : item.id)
              }
              onRemove={() => {
                if (expandedId === item.id) setExpandedId(null);
                onRemoveFile(item.id);
              }}
            />
          ))}
        </div>
        
        <div className="frame-sprocket w-full"></div>
      </div>

      {/* Expanded metadata table below filmstrip */}
      {expandedItem && expandedItem.metadata && (
        <div className="mt-2 animate-fade-in-up">
          <MetadataTable
            metadata={expandedItem.metadata}
            keepTags={expandedItem.keepTags}
            onToggleTag={(tag) => onToggleTag(expandedItem.id, tag)}
            isJpeg={expandedItem.file.type === 'image/jpeg'}
          />
        </div>
      )}
    </div>
  );
}

function FileFrame({ item, isExpanded, onToggleExpand, onRemove }) {
  const metadataLoading = item.metadata === null;

  return (
    <div 
      role="button"
      tabIndex={0}
      aria-label={`Inspect metadata for ${item.file.name}`}
      aria-expanded={isExpanded}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onToggleExpand();
        }
      }}
      className={`relative flex-shrink-0 w-36 h-36 frame overflow-hidden cursor-pointer snap-start transition-all focus:outline-none focus:ring-2 focus:ring-safelight-500 ${
        isExpanded ? 'ring-2 ring-safelight-500 border-safelight-500' : 'hover:border-ink-400'
      }`}
      onClick={onToggleExpand}
    >
      {/* Thumbnail */}
      <div className="w-full h-[88px] bg-ink-200 dark:bg-ink-800">
        <img
          src={item.thumbnailUrl}
          alt={item.file.name}
          className="w-full h-full object-cover"
          loading="lazy"
        />
      </div>

      {/* Caption strip */}
      <div className="p-2 flex flex-col justify-between h-14 bg-ink-50 dark:bg-ink-900 border-t border-ink-200 dark:border-ink-800">
        <p className="text-[10px] font-medium text-ink-800 dark:text-ink-200 truncate" title={item.file.name}>
          {item.file.name}
        </p>
        <div className="flex items-center justify-between mt-1">
          {metadataLoading ? (
             <span className="w-3 h-3 rounded-sm border-2 border-ink-300 border-t-safelight-500 animate-spin" />
          ) : (
             <PrivacyBadge level={item.privacyLevel} />
          )}
          <span className="text-[10px] text-ink-500 dark:text-ink-400">
            {formatFileSize(item.file.size)}
          </span>
        </div>
      </div>

      {/* Remove tab */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          onRemove();
        }}
        className="absolute top-0 right-0 w-6 h-6 bg-ink-950/70 hover:bg-safelight-500 text-ink-100 flex items-center justify-center rounded-bl-sm transition-colors backdrop-blur-sm"
        aria-label={`Remove ${item.file.name}`}
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <line x1="18" y1="6" x2="6" y2="18" />
          <line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      </button>
    </div>
  );
}
