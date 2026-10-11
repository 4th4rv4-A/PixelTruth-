import { useState, useRef } from 'react';
import toast from 'react-hot-toast';
import { stripFull, stripSelective } from '../utils/stripMetadata';
import { downloadAsZip } from '../utils/zipDownload';
import { formatSize, formatSizeComparison } from '../utils/sizeUtils';
import { getOutputFilename } from '../utils/filenameUtils';

export default function CleanButton({
  files,
  fullSanitize,
  onFullSanitizeChange,
  onFilesCleaned,
  sizeReport,
  setSizeReport,
}) {
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0, stage: '' });
  const abortControllerRef = useRef(null);

  if (files.length === 0) return null;

  const isBulk = files.length > 1;
  const anyCleaned = files.some((f) => f.status === 'CLEANED' && f.cleanedBlob);

  const handleCleanAll = async () => {
    if (processing) {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      return;
    }

    setProcessing(true);
    setSizeReport(null);
    setProgress({ current: 0, total: files.length, stage: 'STARTING' });

    const controller = new AbortController();
    abortControllerRef.current = controller;

    const cleanedResults = [];
    const sizeEntries = [];
    let errorCount = 0;

    for (let i = 0; i < files.length; i++) {
      const item = files[i];
      setProgress({ current: i + 1, total: files.length, stage: 'PROCESSING' });

      try {
        let cleanedBlob;
        const isJpeg = item.file.type === 'image/jpeg';

        const onProgress = (data) => {
          setProgress({ current: i + 1, total: files.length, stage: data.stage });
        };

        if (isJpeg && item.keepTags.length > 0) {
          cleanedBlob = await stripSelective(item.file, item.keepTags, fullSanitize, onProgress, controller.signal);
        } else {
          cleanedBlob = await stripFull(item.file, fullSanitize, onProgress, controller.signal);
        }

        const outputName = getOutputFilename(item.file.name, cleanedBlob.type);

        cleanedResults.push({
          id: item.id,
          name: outputName,
          blob: cleanedBlob,
        });

        sizeEntries.push({
          name: outputName,
          originalSize: item.file.size,
          cleanedSize: cleanedBlob.size,
        });
      } catch (err) {
        if (err.message === 'CANCELLED' || err.message === 'TIMEOUT') {
          break;
        }
        errorCount++;
        toast.error(`Failed to clean "${item.file.name}": ${err.message || 'Unknown error'}`);
        console.error('Clean failed for', item.file.name, err);
      }
    }

    if (cleanedResults.length > 0) {
      onFilesCleaned(cleanedResults);

      try {
        await downloadAsZip(cleanedResults.map(r => ({ name: r.name, blob: r.blob })));

        // Calculate totals for size report
        const totalOriginal = sizeEntries.reduce((sum, e) => sum + e.originalSize, 0);
        const totalCleaned = sizeEntries.reduce((sum, e) => sum + e.cleanedSize, 0);
        setSizeReport({
          entries: sizeEntries,
          totalOriginal,
          totalCleaned,
        });
      } catch (err) {
        toast.error(`Download failed: ${err.message || 'Unknown error'}`);
        console.error('Download failed:', err);
      }
    }

    if (controller.signal.aborted) {
      toast('Processing cancelled', { icon: '🛑' });
    } else if (errorCount > 0 && cleanedResults.length > 0) {
      toast(`${cleanedResults.length} file${cleanedResults.length === 1 ? '' : 's'} cleaned, ${errorCount} failed`, {
        icon: '⚠️',
      });
    } else if (errorCount > 0 && cleanedResults.length === 0) {
      toast.error('All files failed to process.');
    } else if (cleanedResults.length > 0) {
      toast.success(`${cleanedResults.length} file${cleanedResults.length === 1 ? '' : 's'} cleaned successfully!`);
    }

    setProcessing(false);
    setProgress({ current: 0, total: 0, stage: '' });
    abortControllerRef.current = null;
  };

  const handleSaveAllZip = async () => {
    const cleaned = files
      .filter((f) => f.status === 'CLEANED' && f.cleanedBlob)
      .map((f) => ({ name: f.cleanedName, blob: f.cleanedBlob }));

    if (cleaned.length === 0) {
      toast.error('No cleaned files ready to save. Click Clean All first.');
      return;
    }

    try {
      await downloadAsZip(cleaned);
      toast.success(`Downloaded ${cleaned.length} cleaned files in ZIP`);
    } catch (err) {
      toast.error(`Download failed: ${err.message || 'Unknown error'}`);
    }
  };

  return (
    <div className="animate-fade-in-up space-y-3">
      {/* Policy options */}
      {!processing && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-3 frame bg-ink-50/50 dark:bg-ink-900/50">
          <label className="flex items-center gap-2 cursor-pointer text-xs text-ink-700 dark:text-ink-300">
            <input
              type="checkbox"
              checked={fullSanitize}
              onChange={(e) => onFullSanitizeChange(e.target.checked)}
              className="w-4 h-4 rounded-sm border-ink-400 dark:border-ink-600 text-safelight-600 focus:ring-safelight-500 cursor-pointer"
            />
            <span>
              <strong>Full Sanitize</strong> (also strips ICC color profile)
            </span>
          </label>

          <span className="text-[11px] text-ink-500 dark:text-ink-400">
            {fullSanitize
              ? 'Color profiles will be stripped alongside all metadata.'
              : 'Orientation & ICC profile preserved by default.'}
          </span>
        </div>
      )}

      {/* Action buttons bar */}
      <div className="flex flex-col sm:flex-row items-stretch gap-3">
        {/* Main Clean All / Bulk Remove Button */}
        <button
          id="clean-button"
          onClick={handleCleanAll}
          disabled={processing}
          className="flex-1 relative group overflow-hidden rounded-lg bg-safelight-500 hover:bg-safelight-400 text-ink-50 font-semibold py-3.5 px-6 transition-all duration-300 shadow-sm disabled:opacity-60 disabled:cursor-not-allowed"
          aria-label={isBulk ? 'Clean all files and download ZIP' : 'Clean image and download'}
        >
          {/* Progress bar */}
          {processing && progress.total > 0 && (
            <div
              className="absolute bottom-0 left-0 h-1 bg-ink-950/20 transition-all duration-300"
              style={{
                width: `${(progress.current / progress.total) * 100}%`,
              }}
            />
          )}

          <span className="relative flex items-center justify-center gap-2">
            {processing ? (
              <>
                <span className="w-5 h-5 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                <span>
                  PROCESSING {progress.current} of {progress.total}
                </span>
              </>
            ) : (
              <>
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="7 10 12 15 17 10" />
                  <line x1="12" y1="15" x2="12" y2="3" />
                </svg>
                <span>
                  {isBulk
                    ? `Clean All (Bulk Remove — ${files.length} files)`
                    : 'Clean All & Download'}
                </span>
              </>
            )}
          </span>
        </button>

        {/* Global Save All (ZIP) Button */}
        {anyCleaned && !processing && (
          <button
            onClick={handleSaveAllZip}
            className="sm:w-auto px-6 py-3.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-sm flex items-center justify-center gap-2 shadow-sm transition-colors"
            aria-label="Save all cleaned files as ZIP archive"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            <span>SAVE ALL (ZIP)</span>
          </button>
        )}
      </div>

      {/* Cancel processing button */}
      {processing && (
        <button
          onClick={() => {
            if (abortControllerRef.current) {
              abortControllerRef.current.abort();
            }
          }}
          className="w-full bg-warn-100 hover:bg-warn-200 text-warn-700 font-medium py-2 px-4 rounded-lg transition-colors text-xs"
          aria-label="Cancel in-flight metadata cleaning"
        >
          Cancel Processing
        </button>
      )}

      {/* HEIC notice if HEIC files present */}
      {!processing && files.some(f => f.file.type === 'image/heic' || f.file.type === 'image/heif' || f.file.name.toLowerCase().endsWith('.heic') || f.file.name.toLowerCase().endsWith('.heif')) && (
        <div className="p-3 bg-warn-900/20 border border-warn-500/30 rounded-lg text-xs text-warn-400 text-left">
          <strong className="block mb-0.5">HEIC Transcoding Notice:</strong>
          HEIC metadata removal converts images to clean JPEG in the browser. Output is visually lossless.
        </div>
      )}

      {/* Size report */}
      {sizeReport && (
        <div className="frame p-4 space-y-2 animate-fade-in-up" role="status" aria-live="polite">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-semibold text-ink-500 dark:text-ink-400 uppercase tracking-wider">
              Size Comparison Report
            </h3>
            <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">
              {formatSizeComparison(sizeReport.totalOriginal, sizeReport.totalCleaned)}
            </span>
          </div>

          <div className="text-sm text-ink-700 dark:text-ink-300 font-medium">
            Original: {formatSize(sizeReport.totalOriginal)} → Cleaned: {formatSize(sizeReport.totalCleaned)}
          </div>

          {sizeReport.entries.length > 1 && (
            <div className="max-h-32 overflow-y-auto space-y-1 pt-1 border-t border-ink-200 dark:border-ink-800">
              {sizeReport.entries.map((entry, i) => (
                <div key={i} className="text-xs text-ink-500 dark:text-ink-400 flex justify-between">
                  <span className="truncate mr-2">{entry.name}</span>
                  <span className="flex-shrink-0 font-mono">
                    {formatSize(entry.originalSize)} → {formatSize(entry.cleanedSize)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Privacy guarantee badge */}
      <p className="text-center text-xs text-ink-400 dark:text-ink-500 flex items-center justify-center gap-1.5 pt-1">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
          <path d="M7 11V7a5 5 0 0 1 10 0v4" />
        </svg>
        100% in-browser processing — your images never leave this computer
      </p>
    </div>
  );
}
