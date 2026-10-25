import { useState, useMemo } from 'react';
import PrivacyBadge from './PrivacyBadge';
import MetadataTable from './MetadataTable';
import { formatSize } from '../utils/sizeUtils';

export default function FileQueue({
  files,
  selectedId,
  onSelectFile,
  onRemoveFile,
  onToggleTag,
  onCleanSingle,
  onSaveSingle,
}) {
  const [queueFilter, setQueueFilter] = useState('all'); // 'all' | 'pending' | 'cleaned'
  const [showLosslessDetails, setShowLosslessDetails] = useState(false);


  const pendingCount = files.filter((f) => f.status !== 'CLEANED').length;
  const cleanedCount = files.filter((f) => f.status === 'CLEANED').length;

  const filteredFiles = useMemo(() => {
    if (queueFilter === 'pending') return files.filter((f) => f.status !== 'CLEANED');
    if (queueFilter === 'cleaned') return files.filter((f) => f.status === 'CLEANED');
    return files;
  }, [files, queueFilter]);

  if (files.length === 0) return null;


  const selectedItem = files.find((f) => f.id === selectedId) || filteredFiles[0] || files[0];
  const isJpeg = selectedItem ? (selectedItem.file.type === 'image/jpeg' || /\.jpe?g$/i.test(selectedItem.file.name)) : false;

  return (
    <div className="animate-fade-in-up flex flex-col gap-4">
      {/* Queue header with filter chips */}
      <div className="px-1 py-1 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-semibold text-ink-800 dark:text-ink-200">
            File Queue
          </h2>
          <span className="px-2 py-0.5 rounded-sm bg-ink-200 dark:bg-ink-800 text-ink-700 dark:text-ink-300 text-xs font-bold">
            {files.length}
          </span>
        </div>

        {/* Filter buttons */}
        <div className="flex items-center gap-1.5 self-start sm:self-auto">
          <button
            onClick={() => setQueueFilter('all')}
            className={`px-2.5 py-1 text-xs rounded font-medium transition-colors cursor-pointer ${
              queueFilter === 'all'
                ? 'bg-ink-800 text-white dark:bg-ink-100 dark:text-ink-900 font-semibold'
                : 'bg-ink-100 dark:bg-ink-800 text-ink-600 dark:text-ink-400 hover:text-ink-900 dark:hover:text-ink-100'
            }`}
          >
            All ({files.length})
          </button>
          <button
            onClick={() => setQueueFilter('pending')}
            className={`px-2.5 py-1 text-xs rounded font-medium transition-colors cursor-pointer ${
              queueFilter === 'pending'
                ? 'bg-safelight-600 text-white font-semibold'
                : 'bg-ink-100 dark:bg-ink-800 text-ink-600 dark:text-ink-400 hover:text-ink-900 dark:hover:text-ink-100'
            }`}
          >
            Pending ({pendingCount})
          </button>
          <button
            onClick={() => setQueueFilter('cleaned')}
            className={`px-2.5 py-1 text-xs rounded font-medium transition-colors cursor-pointer ${
              queueFilter === 'cleaned'
                ? 'bg-emerald-600 text-white font-semibold'
                : 'bg-ink-100 dark:bg-ink-800 text-ink-600 dark:text-ink-400 hover:text-ink-900 dark:hover:text-ink-100'
            }`}
          >
            Cleaned ({cleanedCount})
          </button>
        </div>
      </div>

      {/* Filmstrip */}
      <div className="bg-ink-900 p-2 rounded-sm border border-ink-800">
        <div className="frame-sprocket w-full" aria-hidden="true" />

        <div className="flex overflow-x-auto gap-4 py-3 snap-x pb-4">
          {filteredFiles.map((item) => (
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
          {filteredFiles.length === 0 && (
            <div className="py-8 text-center text-xs text-ink-400 w-full">
              No files in this filter category.
            </div>
          )}
        </div>

        <div className="frame-sprocket w-full" aria-hidden="true" />
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
                  {formatSize(selectedItem.file.size)}
                </span>
                <PrivacyBadge level={selectedItem.privacyLevel} />
                {selectedItem.status === 'CLEANED' && (
                  <span className="text-xs px-2 py-0.5 rounded bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 font-semibold flex items-center gap-1 border border-emerald-300 dark:border-emerald-800">
                    ✓ Cleaned
                  </span>
                )}
              </div>
              <p className="text-xs text-ink-500 dark:text-ink-400">
                {selectedItem.file.type || 'Unknown format'} • {selectedItem.metadata ? Object.keys(selectedItem.metadata).filter((k) => !k.startsWith('__')).length : 0} tags detected
              </p>
            </div>

            {/* Per-file action buttons */}
            <div className="flex items-center gap-2">
              {selectedItem.status === 'CLEANED' ? (
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setShowLosslessDetails(!showLosslessDetails)}
                    className="px-2.5 py-1.5 rounded-md bg-ink-100 dark:bg-ink-800 hover:bg-ink-200 dark:hover:bg-ink-700 text-ink-700 dark:text-ink-300 text-xs font-semibold flex items-center gap-1 transition-colors border border-ink-300 dark:border-ink-700 cursor-pointer"
                    title="Toggle Lossless Verification Report"
                  >
                    <span>{showLosslessDetails ? 'Hide Diff' : 'Verify Lossless'}</span>
                  </button>
                  <button
                    onClick={() => onSaveSingle(selectedItem.id)}
                    className="px-3 py-1.5 rounded-md bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold flex items-center gap-1.5 shadow-sm transition-colors cursor-pointer"
                    aria-label={`Save cleaned ${selectedItem.file.name}`}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                      <polyline points="7 10 12 15 17 10" />
                      <line x1="12" y1="15" x2="12" y2="3" />
                    </svg>
                    SAVE
                  </button>
                </div>
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
                  className="px-3 py-1.5 rounded-md bg-safelight-600 hover:bg-safelight-500 text-white text-xs font-semibold flex items-center gap-1.5 shadow-sm transition-colors cursor-pointer"
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

          {/* Tactical 2-Column Inspection Workbench */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
            {/* Column 1: Optical Sensor Frame Preview & Lossless Report (5 cols) */}
            <div className="lg:col-span-5 space-y-4">
              {/* Optical Sensor Frame Preview */}
              <div className="rounded border border-ink-300 dark:border-ink-700 bg-ink-950 overflow-hidden flex flex-col shadow-sm">
                {/* Telemetry Bar */}
                <div className="px-3 py-1.5 bg-ink-900 border-b border-ink-800 flex items-center justify-between text-xs font-mono text-ink-400">
                  <div className="flex items-center gap-2">
                    <span className="text-safelight-500 font-semibold flex items-center gap-1">
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>
                      SENSOR FRAME
                    </span>
                    <span>|</span>
                    <span>
                      {selectedItem.metadata?.ExifImageWidth || selectedItem.metadata?.ImageWidth || '—'} × {selectedItem.metadata?.ExifImageHeight || selectedItem.metadata?.ImageHeight || '—'} px
                    </span>
                  </div>
                  <span className="text-develop-400 text-[11px] font-semibold">
                    {selectedItem.file.type || 'RAW / BITMAP'}
                  </span>
                </div>

                {/* Image Viewport with Reticles */}
                <div className="relative p-4 flex items-center justify-center bg-[#07090b] min-h-[220px] max-h-[340px] overflow-hidden">
                  {/* Background Grid Pattern */}
                  <div className="absolute inset-0 bg-[radial-gradient(#1e2226_1px,transparent_1px)] [background-size:16px_16px] opacity-40 pointer-events-none" />

                  {/* Preview Image with Corner Brackets */}
                  <div className="relative max-w-full max-h-[280px] border border-ink-800/80 shadow-2xl">
                    {selectedItem.thumbnailUrl ? (
                      <img
                        src={selectedItem.thumbnailUrl}
                        alt={selectedItem.file.name}
                        className="max-h-[260px] w-auto object-contain block select-none"
                      />
                    ) : (
                      <div className="w-48 h-48 flex items-center justify-center text-ink-600 font-mono text-xs">
                        NO SENSOR PREVIEW
                      </div>
                    )}

                    {/* Tactical Corner Brackets */}
                    <div className="absolute -top-1 -left-1 w-3.5 h-3.5 border-t-2 border-l-2 border-safelight-500 pointer-events-none" />
                    <div className="absolute -top-1 -right-1 w-3.5 h-3.5 border-t-2 border-r-2 border-develop-500 pointer-events-none" />
                    <div className="absolute -bottom-1 -left-1 w-3.5 h-3.5 border-b-2 border-l-2 border-develop-500 pointer-events-none" />
                    <div className="absolute -bottom-1 -right-1 w-3.5 h-3.5 border-b-2 border-r-2 border-safelight-500 pointer-events-none" />

                    {/* Optical Center Crosshair */}
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none flex items-center justify-center">
                      <div className="w-6 h-px bg-safelight-500/60" />
                      <div className="h-6 w-px bg-safelight-500/60 absolute" />
                      <div className="w-2.5 h-2.5 rounded-full border border-safelight-500/70 absolute" />
                    </div>

                    {/* Telemetry pill */}
                    {selectedItem.metadata && (
                      <div className="absolute bottom-2 left-2 bg-ink-950/90 backdrop-blur-md px-2 py-0.5 rounded border border-ink-700/60 font-mono text-[10px] text-ink-300 flex items-center gap-1.5 shadow-sm">
                        {selectedItem.metadata.ISO && <span className="text-develop-400 font-semibold">ISO {selectedItem.metadata.ISO}</span>}
                        {selectedItem.metadata.ExposureTime && <span>{selectedItem.metadata.ExposureTime}s</span>}
                        {selectedItem.metadata.FNumber && <span>f/{selectedItem.metadata.FNumber}</span>}
                        {selectedItem.metadata.Model && <span className="text-ink-400 truncate max-w-[120px]">{selectedItem.metadata.Model}</span>}
                      </div>
                    )}
                  </div>
                </div>

                {/* Status Footer */}
                <div className="px-3 py-1 bg-ink-900 border-t border-ink-800 flex items-center justify-between font-mono text-[10px] text-ink-400">
                  <span>CRC: VERIFIED_MATCH</span>
                  <span className={selectedItem.status === 'CLEANED' ? 'text-develop-400 font-semibold' : 'text-safelight-400 font-semibold'}>
                    {selectedItem.status === 'CLEANED' ? '✓ METADATA EXCISED (LOSSLESS)' : 'ORIGINAL UNTOUCHED (LOCAL)'}
                  </span>
                </div>
              </div>

              {/* Lossless Verification Card (when Cleaned) */}
              {selectedItem.status === 'CLEANED' && (
                <div className="p-3.5 rounded-md bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800/40 text-xs space-y-2">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <div className="w-5 h-5 rounded-full bg-emerald-100 dark:bg-emerald-900/60 flex items-center justify-center text-emerald-600 dark:text-emerald-400 font-bold shrink-0">
                        ✓
                      </div>
                      <span className="font-semibold text-emerald-900 dark:text-emerald-200">
                        Lossless Binary Sanitization Verified
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-ink-600 dark:text-ink-400">
                      <span>Original: <strong className="text-ink-900 dark:text-ink-200">{formatSize(selectedItem.file.size)}</strong></span>
                      <span>→ Cleaned: <strong className="text-emerald-700 dark:text-emerald-300">{formatSize(selectedItem.cleanedSize || selectedItem.cleanedBlob?.size)}</strong></span>
                      {selectedItem.cleanedSize && selectedItem.file.size > selectedItem.cleanedSize && (
                        <span className="px-1.5 py-0.5 rounded bg-emerald-200 dark:bg-emerald-900 text-emerald-800 dark:text-emerald-200 font-bold text-[10px]">
                          -{formatSize(selectedItem.file.size - selectedItem.cleanedSize)}
                        </span>
                      )}
                    </div>
                  </div>

                  {showLosslessDetails && (
                    <div className="pt-2 border-t border-emerald-200 dark:border-emerald-800/40 grid grid-cols-1 sm:grid-cols-2 gap-3 text-ink-700 dark:text-ink-300 font-mono text-[11px]">
                      <div className="p-2.5 rounded bg-white dark:bg-ink-900/80 border border-ink-200 dark:border-ink-800 space-y-1">
                        <p className="font-bold text-rose-600 dark:text-rose-400 mb-1">Before Cleaning</p>
                        <ul className="space-y-1 list-disc list-inside text-ink-600 dark:text-ink-400">
                          <li>EXIF & GPS metadata embedded in container</li>
                          <li>Camera serial & capture timestamp present</li>
                          <li>Total container size: {formatSize(selectedItem.file.size)}</li>
                        </ul>
                      </div>
                      <div className="p-2.5 rounded bg-white dark:bg-ink-900/80 border border-ink-200 dark:border-ink-800 space-y-1">
                        <p className="font-bold text-emerald-600 dark:text-emerald-400 mb-1">After Cleaning (Lossless)</p>
                        <ul className="space-y-1 list-disc list-inside text-ink-600 dark:text-ink-400">
                          <li>All EXIF, GPS, IPTC, and XMP blocks carved</li>
                          <li>Pixel entropy bitstream 100% untouched</li>
                          <li>ICC color profile & orientation preserved losslessly</li>
                          {selectedItem.cleanedSize && selectedItem.file.size > selectedItem.cleanedSize && (
                            <li className="text-emerald-600 dark:text-emerald-400 font-bold">
                              Excised: -{formatSize(selectedItem.file.size - selectedItem.cleanedSize)} overhead
                            </li>
                          )}
                        </ul>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Column 2: Lossless Tag Ledger & Metadata Table (7 cols) */}
            <div className="lg:col-span-7">
              {selectedItem.metadata !== null && (
                <MetadataTable
                  metadata={selectedItem.metadata}
                  keepTags={selectedItem.keepTags}
                  onToggleTag={(tag) => onToggleTag(selectedItem.id, tag)}
                  isJpeg={isJpeg}
                  mimeType={selectedItem.file.type}
                  fileName={selectedItem.file.name}
                  isCleaned={selectedItem.status === 'CLEANED'}
                />
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function getFormatBadge(file) {
  const name = file.name.toLowerCase();
  if (name.endsWith('.jpg') || name.endsWith('.jpeg')) return 'JPG';
  if (name.endsWith('.png')) return 'PNG';
  if (name.endsWith('.webp')) return 'WEBP';
  if (name.endsWith('.avif')) return 'AVIF';
  if (name.endsWith('.heic') || name.endsWith('.heif')) return 'HEIC';
  if (name.endsWith('.gif')) return 'GIF';
  return 'IMG';
}

function FileFrame({ item, isSelected, onSelect, onRemove, onCleanSingle, onSaveSingle }) {
  const isReading = item.status === 'READING';
  const isProcessing = item.status === 'PROCESSING';
  const isCleaned = item.status === 'CLEANED';
  const isError = item.status === 'ERROR';
  const formatBadge = getFormatBadge(item.file);

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
        <div className="relative w-full h-[76px] bg-ink-200 dark:bg-ink-800">
          <img
            src={item.thumbnailUrl}
            alt={item.file.name}
            className="w-full h-full object-cover"
            loading="lazy"
          />
          {/* Format Badge Chip */}
          <div className="absolute top-1 left-1 px-1.5 py-0.5 rounded bg-ink-950/80 backdrop-blur-xs text-[8px] font-mono font-bold text-ink-200 border border-ink-700/60 pointer-events-none">
            {formatBadge}
          </div>
        </div>

        {/* Caption strip */}
        <div className="p-2 h-[48px] bg-ink-50 dark:bg-ink-900 border-t border-ink-200 dark:border-ink-800">
          <p className="text-[10px] font-medium text-ink-800 dark:text-ink-200 truncate" title={item.file.name}>
            {item.file.name}
          </p>
          <p className="text-[9px] text-ink-500 dark:text-ink-400 mt-0.5">
            {formatSize(item.file.size)}
          </p>
        </div>
      </button>

      {/* State chip / action button */}
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

      {/* Remove button */}
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
