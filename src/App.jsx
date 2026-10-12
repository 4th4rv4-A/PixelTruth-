import { useState, useCallback, useRef, useEffect } from 'react';
import { Toaster } from 'react-hot-toast';
import toast from 'react-hot-toast';
import Header from './components/Header';
import Dropzone from './components/Dropzone';
import FileQueue from './components/FileQueue';
import CleanButton from './components/CleanButton';
import SeoContent from './components/SeoContent';
import InstallPrompt from './components/InstallPrompt';
import ErrorBoundary from './components/ErrorBoundary';
import { createSafeThumbnail, MAX_FILES } from './utils/normalizeInput';
import { readMetadata, getPrivacyLevel } from './utils/readMetadata';
import { stripFull, stripSelective } from './utils/stripMetadata';
import { downloadSingle } from './utils/zipDownload';
import { getOutputFilename } from './utils/filenameUtils';
import { readC2paManifest, flattenC2paRows } from './utils/c2paRows';

let fileIdCounter = 0;

export default function App() {
  // ─── File state ──────────────────────────────────────
  const [cleanFiles, setCleanFiles] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [fullSanitize, setFullSanitize] = useState(false);
  const [sizeReport, setSizeReport] = useState(null);

  const cleanFilesRef = useRef([]);
  const cleanInFlightRef = useRef(0);

  useEffect(() => {
    cleanFilesRef.current = cleanFiles;
  }, [cleanFiles]);

  // Controllers for background tasks
  const abortControllersRef = useRef(new Map());

  // Cleanup object URLs and pending tasks on unmount
  useEffect(() => {
    const controllers = abortControllersRef.current;
    return () => {
      cleanFilesRef.current.forEach((item) => {
        if (item.thumbnailUrl) URL.revokeObjectURL(item.thumbnailUrl);
      });
      for (const controller of controllers.values()) {
        controller.abort();
      }
      controllers.clear();
    };
  }, []);

  /* ════════════════════════════════════════════════════
   *  HANDLERS
   * ════════════════════════════════════════════════════ */

  const reserveCleanSlots = useCallback((count) => {
    const total = cleanFilesRef.current.length + cleanInFlightRef.current;
    const available = Math.max(0, MAX_FILES - total);
    const accepted = Math.min(count, available);
    cleanInFlightRef.current += accepted;
    return { accepted, available };
  }, []);

  const releaseCleanSlots = useCallback((count) => {
    cleanInFlightRef.current = Math.max(0, cleanInFlightRef.current - count);
  }, []);

  const handleCleanFilesAdded = useCallback(async (newFiles) => {
    const availableSlots = Math.max(0, MAX_FILES - cleanFilesRef.current.length);
    const filesToAccept = newFiles.slice(0, availableSlots);

    if (filesToAccept.length === 0) {
      toast.error(`Maximum ${MAX_FILES} files allowed`);
      return;
    }

    const pendingItems = await Promise.all(
      filesToAccept.map(async (file) => ({
        id: `clean-${++fileIdCounter}`,
        file,
        thumbnailUrl: await createSafeThumbnail(file),
        metadata: null,
        privacyLevel: 'low',
        keepTags: [],
        status: 'READING', // 'READING' | 'IDLE' | 'PROCESSING' | 'CLEANED' | 'ERROR'
        cleanedBlob: null,
        cleanedName: null,
      }))
    );

    const allowedItems = pendingItems;
    setCleanFiles((prev) => {
      const remaining = Math.max(0, MAX_FILES - prev.length);
      const itemsToAdd = allowedItems.slice(0, remaining);
      const dropped = allowedItems.slice(remaining);
      dropped.forEach((item) => {
        if (item.thumbnailUrl) URL.revokeObjectURL(item.thumbnailUrl);
      });
      cleanInFlightRef.current = Math.max(0, cleanInFlightRef.current - filesToAccept.length);
      return [...prev, ...itemsToAdd];
    });

    // Auto-select first added file if none is selected
    setSelectedId((current) => current || allowedItems[0]?.id || null);

    // Read metadata for each file
    for (const item of allowedItems) {
      const controller = new AbortController();
      abortControllersRef.current.set(item.id, controller);

      try {
        const metadata = await readMetadata(item.file, controller.signal);
        const privacyLevel = getPrivacyLevel(metadata);

        // Render EXIF/JFIF rows immediately. Content Credentials (C2PA) hydrate
        // separately below so the heavy WASM read never blocks the metadata table.
        setCleanFiles((prev) =>
          prev.map((f) =>
            f.id === item.id
              ? { ...f, metadata: { ...metadata, __c2pa: [] }, privacyLevel, status: 'IDLE' }
              : f
          )
        );

        // Content Credentials (C2PA) — lazy and non-blocking, mirroring exifremover.com.
        readC2paManifest(item.file, controller.signal)
          .then((manifest) => {
            const rows = flattenC2paRows(manifest);
            if (!rows.length) return;
            setCleanFiles((prev) =>
              prev.map((f) =>
                f.id === item.id ? { ...f, metadata: { ...f.metadata, __c2pa: rows } } : f
              )
            );
          })
          .catch(() => {
            /* no credentials, decode error, or cancelled — rows stay empty */
          })
          .finally(() => {
            abortControllersRef.current.delete(item.id);
          });
      } catch (err) {
        abortControllersRef.current.delete(item.id);
        if (err.message !== 'CANCELLED') {
          setCleanFiles((prev) =>
            prev.map((f) =>
              f.id === item.id ? { ...f, metadata: { __c2pa: [] }, privacyLevel: 'low', status: 'IDLE' } : f
            )
          );
        }
      }
    }
  }, []);

  const handleCleanRemoveFile = useCallback((id) => {
    const controller = abortControllersRef.current.get(id);
    if (controller) {
      controller.abort();
      abortControllersRef.current.delete(id);
    }

    setCleanFiles((prev) => {
      const item = prev.find((f) => f.id === id);
      if (item?.thumbnailUrl) URL.revokeObjectURL(item.thumbnailUrl);
      const nextList = prev.filter((f) => f.id !== id);

      // Adjust selected file if removing current selected
      setSelectedId((currSelected) => {
        if (currSelected === id) {
          return nextList[0]?.id || null;
        }
        return currSelected;
      });

      return nextList;
    });
  }, []);

  const handleClearAll = useCallback(() => {
    // Abort all in flight
    for (const controller of abortControllersRef.current.values()) {
      controller.abort();
    }
    abortControllersRef.current.clear();

    // Revoke thumbnails
    cleanFilesRef.current.forEach((item) => {
      if (item.thumbnailUrl) URL.revokeObjectURL(item.thumbnailUrl);
    });

    setCleanFiles([]);
    setSelectedId(null);
    setSizeReport(null);
    toast('Queue cleared', { icon: '🧹' });
  }, []);

  const handleToggleTag = useCallback((fileId, tag) => {
    setCleanFiles((prev) =>
      prev.map((f) => {
        if (f.id !== fileId) return f;
        const keepTags = f.keepTags.includes(tag)
          ? f.keepTags.filter((t) => t !== tag)
          : [...f.keepTags, tag];
        return { ...f, keepTags };
      })
    );
  }, []);

  const handleCleanSingle = useCallback(async (fileId) => {
    const item = cleanFilesRef.current.find((f) => f.id === fileId);
    if (!item) return;

    setCleanFiles((prev) =>
      prev.map((f) => (f.id === fileId ? { ...f, status: 'PROCESSING' } : f))
    );

    const controller = new AbortController();
    abortControllersRef.current.set(fileId, controller);

    try {
      let cleanedBlob;
      const isJpeg = item.file.type === 'image/jpeg';

      if (isJpeg && item.keepTags.length > 0) {
        cleanedBlob = await stripSelective(item.file, item.keepTags, fullSanitize, null, controller.signal);
      } else {
        cleanedBlob = await stripFull(item.file, fullSanitize, null, controller.signal);
      }

      const outputName = getOutputFilename(item.file.name, cleanedBlob.type);

      setCleanFiles((prev) =>
        prev.map((f) =>
          f.id === fileId
            ? {
                ...f,
                status: 'CLEANED',
                cleanedBlob,
                cleanedName: outputName,
                cleanedSize: cleanedBlob.size,
              }
            : f
        )
      );

      toast.success(`"${item.file.name}" cleaned! Click SAVE to download.`);
    } catch (err) {
      if (err.message !== 'CANCELLED') {
        toast.error(`Failed to clean "${item.file.name}": ${err.message || 'Error'}`);
        setCleanFiles((prev) =>
          prev.map((f) => (f.id === fileId ? { ...f, status: 'ERROR' } : f))
        );
      }
    } finally {
      abortControllersRef.current.delete(fileId);
    }
  }, [fullSanitize]);

  const handleSaveSingle = useCallback((fileId) => {
    const item = cleanFilesRef.current.find((f) => f.id === fileId);
    if (!item || !item.cleanedBlob) {
      toast.error('Cleaned file not found.');
      return;
    }
    downloadSingle(item.cleanedName, item.cleanedBlob);
  }, []);

  const handleFilesCleaned = useCallback((cleanedResults) => {
    const resultMap = new Map(cleanedResults.map((r) => [r.id, r]));
    setCleanFiles((prev) =>
      prev.map((f) => {
        const res = resultMap.get(f.id);
        if (res) {
          return {
            ...f,
            status: 'CLEANED',
            cleanedBlob: res.blob,
            cleanedName: res.name,
            cleanedSize: res.blob.size,
          };
        }
        return f;
      })
    );
  }, []);

  return (
    <ErrorBoundary onReset={() => window.location.reload()}>
      <div className="min-h-screen flex flex-col">
        <Toaster
          position="top-right"
          toastOptions={{
            duration: 4000,
            style: {
              borderRadius: '12px',
              background: 'var(--color-surface-800)',
              color: '#fff',
              fontSize: '14px',
            },
          }}
        />

        <InstallPrompt />

        <Header />

        <main className="flex-1 max-w-4xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
          <div className="text-center space-y-2 mb-2">
            <h2 className="text-2xl sm:text-3xl font-bold text-surface-900 dark:text-white">
              Clean your image metadata
            </h2>
            <p className="text-surface-500 dark:text-surface-400 max-w-lg mx-auto">
              Remove GPS locations, device info, and other sensitive data from your photos.
              Everything happens in your browser — nothing is uploaded.
            </p>
          </div>

          <ErrorBoundary onReset={handleClearAll}>
            {/* Dropzone with SELECT FILES and CLEAR buttons */}
            <Dropzone
              files={cleanFiles}
              onFilesAdded={handleCleanFilesAdded}
              onReserveSlots={reserveCleanSlots}
              onReleaseSlots={releaseCleanSlots}
              onClearAll={handleClearAll}
            />

            {/* File Filmstrip and Metadata Inspector */}
            <FileQueue
              files={cleanFiles}
              selectedId={selectedId}
              onSelectFile={setSelectedId}
              onRemoveFile={handleCleanRemoveFile}
              onToggleTag={handleToggleTag}
              onCleanSingle={handleCleanSingle}
              onSaveSingle={handleSaveSingle}
            />

            {/* Clean All (Bulk Remove) / Save All / Full Sanitize / Size Report */}
            <CleanButton
              files={cleanFiles}
              fullSanitize={fullSanitize}
              onFullSanitizeChange={setFullSanitize}
              onFilesCleaned={handleFilesCleaned}
              sizeReport={sizeReport}
              setSizeReport={setSizeReport}
            />
          </ErrorBoundary>

          {/* SEO Content & Comparison Guide */}
          <SeoContent />

          {/* Footer */}
          <footer className="text-center pt-8 pb-4">
            <p className="text-xs text-surface-400 dark:text-surface-600">
              PixelTruth v2.0.0 — Image Metadata Remover
            </p>
          </footer>
        </main>
      </div>
    </ErrorBoundary>
  );
}
