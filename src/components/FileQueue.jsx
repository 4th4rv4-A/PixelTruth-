import PrivacyBadge from './PrivacyBadge';
import MetadataTable from './MetadataTable';

function formatFileSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function FileQueue({
  files,
  selectedId,
  onSelectFile,
  onRemoveFile,
  onToggleTag,
  onCleanSingle,
  onSaveSingle,
}) {
  if (files.length === 0) return null;

  const selectedItem = files.find((f) => f.id === selectedId) || files[0];

  return (
    <div className="animate-fade-in-up flex flex-col gap-4">
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
          Click an image below to inspect metadata and remove tags
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
              isSelected={selectedItem?.id === item.id}
              onSelect={() => onSelectFile(item.id)}
              onRemove={() => onRemoveFile(item.id)}
              onCleanSingle={() => onCleanSingle(item.id)}
              onSaveSingle={() => onSaveSingle(item.id)}
            />
          ))}
        </div>

        <div className="frame-sprocket w-full"></div>
      </div>

      {/* Selected file detail header and metadata table */}
      {selectedItem && (
        <div className="frame p-4 space-y-4 animate-fade-in-up">
          {/* File Header & Per-File Actions */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-ink-200 dark:border-ink-800">
            <div className="space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-semibold text-sm text-ink-900 dark:text-ink-100 truncate max-w-xs" title={selectedItem.file.name}>
                  {selectedItem.file.name}
                </span>
                <span className="text-xs px-2 py-0.5 rounded bg-ink-100 dark:bg-ink-800 text-ink-600 dark:text-ink-400 font-mono">
                  {formatFileSize(selectedItem.file.size)}
                </span>
                <PrivacyBadge level={selectedItem.privacyLevel} />
              </div>
              <p className="text-xs text-ink-500 dark:text-ink-400">
                {selectedItem.file.type || 'Unknown format'} • {selectedItem.metadata ? Object.keys(selectedItem.metadata).filter((k) => !k.startsWith('__')).length : 0} tags detected
              </p>
            </div>

            {/* Per-file action buttons */}
            <div className="flex items-center gap-2">
              {selectedItem.status === 'CLEANED' ? (
                <button
                  onClick={() => onSaveSingle(selectedItem.id)}
                  className="px-3 py-1.5 rounded-md bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold flex items-center gap-1.5 shadow-sm transition-colors"
                  aria-label={`Save cleaned ${selectedItem.file.name}`}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                    <polyline points="7 10 12 15 17 10" />
                    <line x1="12" y1="15" x2="12" y2="3" />
                  </svg>
                  SAVE
                </button>
              ) : selectedItem.status === 'PROCESSING' ? (
                <span className="px-3 py-1.5 rounded-md bg-safelight-500/20 text-safelight-400 text-xs font-semibold flex items-center gap-1.5">
                  <span className="w-3.5 h-3.5 rounded-full border-2 border-current border-t-transparent animate-spin" />
                  PROCESSING…
                </span>
              ) : selectedItem.status === 'READING' ? (
                <span className="px-3 py-1.5 rounded-md bg-ink-200 dark:bg-ink-800 text-ink-500 text-xs font-semibold flex items-center gap-1.5">
                  <span className="w-3.5 h-3.5 rounded-full border-2 border-current border-t-transparent animate-spin" />
                  READING…
                </span>
              ) : (
                <button
                  onClick={() => onCleanSingle(selectedItem.id)}
                  className="px-3 py-1.5 rounded-md bg-safelight-600 hover:bg-safelight-500 text-white text-xs font-semibold flex items-center gap-1.5 shadow-sm transition-colors"
                  aria-label={`Remove EXIF from ${selectedItem.file.name}`}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M3 6h18" />
                    <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
                    <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
                  </svg>
                  REMOVE EXIF
                </button>
              )}
            </div>
          </div>

          {/* Metadata Table */}
          {selectedItem.metadata !== null && (
            <MetadataTable
              metadata={selectedItem.metadata}
              keepTags={selectedItem.keepTags}
              onToggleTag={(tag) => onToggleTag(selectedItem.id, tag)}
              isJpeg={selectedItem.file.type === 'image/jpeg'}
              mimeType={selectedItem.file.type}
            />
          )}
        </div>
      )}
    </div>
  );
}

function FileFrame({ item, isSelected, onSelect, onRemove, onCleanSingle, onSaveSingle }) {
  const isReading = item.status === 'READING';
  const isProcessing = item.status === 'PROCESSING';
  const isCleaned = item.status === 'CLEANED';
  const isError = item.status === 'ERROR';

  return (
    <div
      className={`relative flex-shrink-0 w-36 h-40 frame overflow-hidden snap-start transition-all ${
        isSelected ? 'ring-2 ring-safelight-500 border-safelight-500' : 'hover:border-ink-400'
      }`}
    >
      {/* Clickable Inspection Area */}
      <button
        type="button"
        role="button"
        aria-label={`Inspect metadata for ${item.file.name}`}
        aria-expanded={isSelected}
        onClick={onSelect}
        className="w-full text-left focus:outline-none focus:ring-2 focus:ring-safelight-500 rounded-sm cursor-pointer"
      >
        {/* Thumbnail */}
        <div className="w-full h-[76px] bg-ink-200 dark:bg-ink-800">
          <img
            src={item.thumbnailUrl}
            alt={item.file.name}
            className="w-full h-full object-cover"
            loading="lazy"
          />
        </div>

        {/* Caption strip */}
        <div className="p-2 h-[48px] bg-ink-50 dark:bg-ink-900 border-t border-ink-200 dark:border-ink-800">
          <p className="text-[10px] font-medium text-ink-800 dark:text-ink-200 truncate" title={item.file.name}>
            {item.file.name}
          </p>
          <p className="text-[9px] text-ink-500 dark:text-ink-400 mt-0.5">
            {formatFileSize(item.file.size)}
          </p>
        </div>
      </button>

      {/* State chip / action button (Sibling, not nested) */}
      <div className="absolute bottom-0 left-0 right-0 px-2 pb-1.5 pt-0.5 flex items-center justify-between bg-ink-50 dark:bg-ink-900">
        {isReading ? (
          <span className="inline-flex items-center gap-1 text-[9px] font-semibold text-ink-500 dark:text-ink-400">
            <span className="w-2.5 h-2.5 rounded-full border border-current border-t-transparent animate-spin" />
            READING…
          </span>
        ) : isProcessing ? (
          <span className="inline-flex items-center gap-1 text-[9px] font-semibold text-safelight-500">
            <span className="w-2.5 h-2.5 rounded-full border border-current border-t-transparent animate-spin" />
            CLEANING…
          </span>
        ) : isCleaned ? (
          <button
            type="button"
            onClick={onSaveSingle}
            className="px-2 py-0.5 rounded text-[9px] font-bold bg-emerald-600 hover:bg-emerald-500 text-white shadow-xs transition-colors cursor-pointer"
            aria-label={`Save ${item.file.name}`}
          >
            SAVE
          </button>
        ) : isError ? (
          <span className="text-[9px] font-bold text-red-500">
            ERROR
          </span>
        ) : (
          <button
            type="button"
            onClick={onCleanSingle}
            className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-ink-200 hover:bg-safelight-600 hover:text-white dark:bg-ink-800 text-ink-700 dark:text-ink-300 transition-colors cursor-pointer"
            aria-label={`Remove EXIF from ${item.file.name}`}
          >
            REMOVE EXIF
          </button>
        )}

        <PrivacyBadge level={item.privacyLevel} />
      </div>

      {/* Remove button (Sibling, not nested) */}
      <button
        type="button"
        onClick={onRemove}
        className="absolute top-0 right-0 w-6 h-6 bg-ink-950/70 hover:bg-safelight-500 text-ink-100 flex items-center justify-center rounded-bl-sm transition-colors backdrop-blur-sm cursor-pointer"
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
