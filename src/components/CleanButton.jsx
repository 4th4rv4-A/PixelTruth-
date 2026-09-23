import { useState, useRef } from 'react';
import toast from 'react-hot-toast';
import { stripFull, stripSelective } from '../utils/stripMetadata';
import { downloadAsZip, downloadSingle } from '../utils/zipDownload';
import { formatSize, formatSizeComparison } from '../utils/sizeUtils';
import { getOutputFilename } from '../utils/filenameUtils';

export default function CleanButton({ files }) {
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0, stage: '' });
  const [sizeReport, setSizeReport] = useState(null);
  const [policy, setPolicy] = useState('PRIVACY_CLEAN'); // 'PRIVACY_CLEAN' or 'FULL_SANITIZE'
  const abortControllerRef = useRef(null);

  if (files.length === 0) return null;

  const isBulk = files.length > 1;

  const handleClean = async () => {
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

    const cleanedFiles = [];
    const sizeEntries = [];
    let errorCount = 0;

    for (let i = 0; i < files.length; i++) {
      const item = files[i];
      setProgress({ current: i + 1, total: files.length });

      try {
        let cleanedBlob;
        const isJpeg = item.file.type === 'image/jpeg';
        
        const onProgress = (data) => {
          setProgress({ current: i + 1, total: files.length, stage: data.stage });
        };

        const preserveC2pa = policy === 'PRIVACY_CLEAN';

        if (isJpeg && item.keepTags.length > 0) {
          cleanedBlob = await stripSelective(item.file, item.keepTags, preserveC2pa, onProgress, controller.signal);
        } else {
          cleanedBlob = await stripFull(item.file, preserveC2pa, onProgress, controller.signal);
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
        if (err.message === 'CANCELLED' || err.message === 'TIMEOUT') {
          break; // Stop processing the rest of the files if cancelled/timeout
        }
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

    if (controller.signal.aborted) {
      toast('Processing cancelled', { icon: '🛑' });
    } else if (errorCount > 0 && cleanedFiles.length > 0) {
      toast(`${cleanedFiles.length} file${cleanedFiles.length === 1 ? '' : 's'} cleaned, ${errorCount} failed`, {
        icon: '⚠️',
      });
    } else if (errorCount > 0 && cleanedFiles.length === 0) {
      toast.error('All files failed to process.');
    } else if (cleanedFiles.length > 0) {
      toast.success(`${cleanedFiles.length} file${cleanedFiles.length === 1 ? '' : 's'} cleaned successfully!`);
    }

    setProcessing(false);
    setProgress({ current: 0, total: 0, stage: '' });
    abortControllerRef.current = null;
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
                {progress.stage || 'PROCESSING'} {progress.current} of {progress.total}
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

      {/* Real Cancel Button rendered alongside/below during processing */}
      {processing && (
        <button
          onClick={() => {
            if (abortControllerRef.current) {
              abortControllerRef.current.abort();
            }
          }}
          className="mt-2 w-full bg-warn-100 hover:bg-warn-200 text-warn-700 font-medium py-2 px-4 rounded-lg transition-colors"
        >
          Cancel Processing
        </button>
      )}

      {/* Cleaning Policy Selection (only show when not processing) */}
      {!processing && (
        <div className="mt-3 flex gap-4 text-sm justify-center">
          <label className="flex items-center gap-2 cursor-pointer">
            <input 
              type="radio" 
              name="policy" 
              value="PRIVACY_CLEAN" 
              checked={policy === 'PRIVACY_CLEAN'} 
              onChange={() => setPolicy('PRIVACY_CLEAN')} 
              className="accent-safelight-500"
            />
            <span className="text-ink-600 dark:text-ink-300">Privacy Clean (Preserve C2PA)</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input 
              type="radio" 
              name="policy" 
              value="FULL_SANITIZE" 
              checked={policy === 'FULL_SANITIZE'} 
              onChange={() => setPolicy('FULL_SANITIZE')} 
              className="accent-safelight-500"
            />
            <span className="text-ink-600 dark:text-ink-300">Full Sanitize (Strip All)</span>
          </label>
        </div>
      )}

      {/* HEIC Transcoding Disclosure */}
      {!processing && files.some(f => f.file.type === 'image/heic' || f.file.type === 'image/heif' || f.file.name.toLowerCase().endsWith('.heic') || f.file.name.toLowerCase().endsWith('.heif')) && (
        <div className="mt-3 p-3 bg-warn-900/20 border border-warn-500/30 rounded-lg text-xs text-warn-400 text-left">
          <strong className="block mb-1">HEIC Transcoding Notice:</strong>
          HEIC cleaning requires transcoding to JPEG in this browser workflow. The resulting JPEG is not bit-for-bit identical to the original HEIC.
        </div>
      )}

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
