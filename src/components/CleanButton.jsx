import { useState } from 'react';
import toast from 'react-hot-toast';
import { stripFull, stripSelective } from '../utils/stripMetadata';
import { downloadAsZip, downloadSingle } from '../utils/zipDownload';
import { formatSize, formatSizeComparison } from '../utils/sizeUtils';
import { getOutputFilename } from '../utils/filenameUtils';

export default function CleanButton({ files }) {
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [sizeReport, setSizeReport] = useState(null);

  if (files.length === 0) return null;

  const isBulk = files.length > 1;

  const handleClean = async () => {
    setProcessing(true);
    setSizeReport(null);
    setProgress({ current: 0, total: files.length });

    const cleanedFiles = [];
    const sizeEntries = [];
    let errorCount = 0;

    for (let i = 0; i < files.length; i++) {
      const item = files[i];
      setProgress({ current: i + 1, total: files.length });

      try {
        let cleanedBlob;
        const isJpeg = item.file.type === 'image/jpeg';

        if (isJpeg && item.keepTags.length > 0) {
          // Selective strip for JPEG with kept tags
          cleanedBlob = await stripSelective(item.file, item.keepTags);
        } else {
          // Full strip for everything else (or JPEG with nothing to keep)
          cleanedBlob = await stripFull(item.file);
        }

        const outputName = getOutputFilename(item.file.name, cleanedBlob.type);

        cleanedFiles.push({
          name: outputName,
          blob: cleanedBlob,
        });

        sizeEntries.push({
          name: outputName,
          originalSize: item.file.size,
          cleanedSize: cleanedBlob.size,
        });
      } catch (err) {
        errorCount++;
        toast.error(`Failed to clean "${item.file.name}": ${err.message || 'Unknown error'}`);
        console.error('Clean failed for', item.file.name, err);
      }
    }

    if (cleanedFiles.length > 0) {
      try {
        if (isBulk || cleanedFiles.length > 1) {
          await downloadAsZip(cleanedFiles);
        } else {
          downloadSingle(cleanedFiles[0].name, cleanedFiles[0].blob);
        }

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

    if (errorCount > 0 && cleanedFiles.length > 0) {
      toast(`${cleanedFiles.length} file${cleanedFiles.length === 1 ? '' : 's'} cleaned, ${errorCount} failed`, {
        icon: '⚠️',
      });
    } else if (errorCount > 0 && cleanedFiles.length === 0) {
      toast.error('All files failed to process.');
    } else if (cleanedFiles.length > 0) {
      toast.success(`${cleanedFiles.length} file${cleanedFiles.length === 1 ? '' : 's'} cleaned successfully!`);
    }

    setProcessing(false);
    setProgress({ current: 0, total: 0 });
  };

  return (
    <div className="animate-fade-in-up">
      <button
        id="clean-button"
        onClick={handleClean}
        disabled={processing}
        className="w-full relative group overflow-hidden rounded-lg bg-safelight-500 hover:bg-safelight-400 text-ink-50 font-semibold py-4 px-6 transition-all duration-300 shadow-sm disabled:opacity-60 disabled:cursor-not-allowed"
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
                Processing {progress.current} of {progress.total}…
              </span>
            </>
          ) : (
            <>
              <svg
                width="20"
                height="20"
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
                  ? `Clean All & Download ZIP (${files.length} files)`
                  : 'Clean & Download'}
              </span>
            </>
          )}
        </span>
      </button>

      {/* Size report */}
      {sizeReport && (
        <div className="mt-3 frame p-4 space-y-2 animate-fade-in-up" role="status" aria-live="polite">
          <h3 className="text-xs font-semibold text-ink-500 dark:text-ink-400 uppercase tracking-wider">
            Size Report
          </h3>
          {sizeReport.entries.length === 1 ? (
            <div className="text-sm text-ink-600 dark:text-ink-400">
              <span>Original: {formatSize(sizeReport.totalOriginal)}</span>
              <span className="mx-2">→</span>
              <span>Cleaned: {formatSize(sizeReport.totalCleaned)}</span>
              <span className="ml-2 text-xs text-ink-400 dark:text-ink-500">
                ({formatSizeComparison(sizeReport.totalOriginal, sizeReport.totalCleaned)})
              </span>
            </div>
          ) : (
            <>
              <div className="text-sm text-ink-600 dark:text-ink-400 font-medium">
                Total: {formatSize(sizeReport.totalOriginal)} → {formatSize(sizeReport.totalCleaned)}
                <span className="ml-2 text-xs text-ink-400 dark:text-ink-500">
                  ({formatSizeComparison(sizeReport.totalOriginal, sizeReport.totalCleaned)})
                </span>
              </div>
              <div className="max-h-32 overflow-y-auto space-y-1">
                {sizeReport.entries.map((entry, i) => (
                  <div key={i} className="text-xs text-ink-500 dark:text-ink-400 flex justify-between">
                    <span className="truncate mr-2">{entry.name}</span>
                    <span className="flex-shrink-0">
                      {formatSize(entry.originalSize)} → {formatSize(entry.cleanedSize)}
                    </span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {/* Privacy assurance */}
      <p className="mt-3 text-center text-xs text-ink-400 dark:text-ink-500 flex items-center justify-center gap-1.5">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
          <path d="M7 11V7a5 5 0 0 1 10 0v4" />
        </svg>
        100% client-side — your images never leave your device
      </p>
    </div>
  );
}
