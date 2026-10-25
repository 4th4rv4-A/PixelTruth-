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
import { cleanImageFile } from './utils/stripMetadata';
import { downloadSingle } from './utils/zipDownload';
import { getOutputFilename } from './utils/filenameUtils';
import { readC2paManifest, flattenC2paRows } from './utils/c2paRows';

function generateFileId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `clean-${crypto.randomUUID()}`;
  }
  return `clean-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

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

  // Controllers for background tasks separated by task type
  const generationRef = useRef(0);
  const metadataControllersRef = useRef(new Map());
  const c2paControllersRef = useRef(new Map());
  const singleCleanControllersRef = useRef(new Map());
  const batchCleanControllerRef = useRef(null);

  // Cleanup object URLs and pending tasks on unmount
  useEffect(() => {
    const metaControllers = metadataControllersRef.current;
    const c2paControllers = c2paControllersRef.current;
    const singleControllers = singleCleanControllersRef.current;
    return () => {
      cleanFilesRef.current.forEach((item) => {
        if (item.thumbnailUrl) URL.revokeObjectURL(item.thumbnailUrl);
      });
      for (const ctrl of metaControllers.values()) ctrl.abort();
      for (const ctrl of c2paControllers.values()) ctrl.abort();
      for (const ctrl of singleControllers.values()) ctrl.abort();
      if (batchCleanControllerRef.current) batchCleanControllerRef.current.abort();
      metaControllers.clear();
      c2paControllers.clear();
      singleControllers.clear();
      batchCleanControllerRef.current = null;
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
    const currentGen = generationRef.current;
    const availableSlots = Math.max(0, MAX_FILES - cleanFilesRef.current.length);
    const filesToAccept = newFiles.slice(0, availableSlots);

    if (filesToAccept.length === 0) {
      toast.error(`Maximum ${MAX_FILES} files allowed`);
      return;
    }

    const pendingItems = await Promise.all(
      filesToAccept.map(async (file) => ({
        id: generateFileId(),
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

    if (currentGen !== generationRef.current) {
      pendingItems.forEach((item) => {
        if (item.thumbnailUrl) URL.revokeObjectURL(item.thumbnailUrl);
      });
      return;
    }

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

    // Read metadata for each file in parallel
    allowedItems.forEach((item) => {
      const metaController = new AbortController();
      metadataControllersRef.current.set(item.id, metaController);

      readMetadata(item.file, metaController.signal)
        .then((metadata) => {
          if (currentGen !== generationRef.current || metaController.signal.aborted) return;
          const privacyLevel = getPrivacyLevel(metadata);

          // Render EXIF/JFIF rows immediately
          setCleanFiles((prev) =>
            prev.map((f) =>
              f.id === item.id
                ? { ...f, metadata: { ...metadata, __c2pa: [] }, privacyLevel, status: 'IDLE' }
                : f
            )
          );

          // Content Credentials (C2PA) with dedicated controller
          const c2paController = new AbortController();
          c2paControllersRef.current.set(item.id, c2paController);

          readC2paManifest(item.file, c2paController.signal)
            .then((manifest) => {
              if (currentGen !== generationRef.current || c2paController.signal.aborted) return;
              const rows = flattenC2paRows(manifest);
              if (!rows.length) return;
              setCleanFiles((prev) =>
                prev.map((f) =>
                  f.id === item.id ? { ...f, metadata: { ...f.metadata, __c2pa: rows } } : f
                )
              );
            })
            .catch(() => {
              /* no credentials, decode error, or cancelled */
            })
            .finally(() => {
              c2paControllersRef.current.delete(item.id);
            });
        })
        .catch((err) => {
          if (currentGen !== generationRef.current || metaController.signal.aborted) return;
          if (err.message !== 'CANCELLED') {
            setCleanFiles((prev) =>
              prev.map((f) =>
                f.id === item.id ? { ...f, metadata: { __c2pa: [] }, privacyLevel: 'low', status: 'IDLE' } : f
              )
            );
          }
        })
        .finally(() => {
          metadataControllersRef.current.delete(item.id);
        });
    });
  }, []);

  const handleCleanRemoveFile = useCallback((id) => {
    const metaCtrl = metadataControllersRef.current.get(id);
    if (metaCtrl) {
      metaCtrl.abort();
      metadataControllersRef.current.delete(id);
    }
    const c2paCtrl = c2paControllersRef.current.get(id);
    if (c2paCtrl) {
      c2paCtrl.abort();
      c2paControllersRef.current.delete(id);
    }
    const cleanCtrl = singleCleanControllersRef.current.get(id);
    if (cleanCtrl) {
      cleanCtrl.abort();
      singleCleanControllersRef.current.delete(id);
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
    generationRef.current++;

    // Abort all in-flight tasks across all task types
    for (const ctrl of metadataControllersRef.current.values()) ctrl.abort();
    for (const ctrl of c2paControllersRef.current.values()) ctrl.abort();
    for (const ctrl of singleCleanControllersRef.current.values()) ctrl.abort();
    if (batchCleanControllerRef.current) {
      batchCleanControllerRef.current.abort();
      batchCleanControllerRef.current = null;
    }

    metadataControllersRef.current.clear();
    c2paControllersRef.current.clear();
    singleCleanControllersRef.current.clear();

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

    const currentGen = generationRef.current;
    setCleanFiles((prev) =>
      prev.map((f) => (f.id === fileId ? { ...f, status: 'PROCESSING' } : f))
    );

    const controller = new AbortController();
    singleCleanControllersRef.current.set(fileId, controller);

    try {
      const cleanedBlob = await cleanImageFile(item.file, {
        keepTags: item.keepTags,
        fullSanitize,
        signal: controller.signal,
      });

      if (currentGen !== generationRef.current || controller.signal.aborted) return;

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
                cleanedVerification: cleanedBlob.verification || null,
              }
            : f
        )
      );

      toast.success(`"${item.file.name}" cleaned! Click SAVE to download.`);
    } catch (err) {
      if (currentGen !== generationRef.current || controller.signal.aborted) return;
      if (err.message !== 'CANCELLED') {
        toast.error(`Failed to clean "${item.file.name}": ${err.message || 'Error'}`);
        setCleanFiles((prev) =>
          prev.map((f) => (f.id === fileId ? { ...f, status: 'ERROR' } : f))
        );
      }
    } finally {
      singleCleanControllersRef.current.delete(fileId);
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
            cleanedVerification: res.blob.verification || null,
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
              background: 'var(--color-ink-900)',
              color: '#fff',
              fontSize: '14px',
              border: '1px solid var(--color-ink-800)',
            },
          }}
        />

        <InstallPrompt />

        <Header files={cleanFiles} />

        <main className={`flex-1 w-full mx-auto px-3 sm:px-6 lg:px-8 py-6 space-y-6 transition-all duration-300 ${cleanFiles.length > 0 ? 'max-w-[1720px]' : 'max-w-4xl'}`}>
          {cleanFiles.length === 0 && (
            <div className="text-center space-y-2 mb-2 animate-fade-in-up">
              <h2 className="text-2xl sm:text-3xl font-bold text-ink-900 dark:text-white">
                Clean your image metadata
              </h2>
              <p className="text-ink-500 dark:text-ink-400 max-w-lg mx-auto">
                Remove GPS locations, device info, and other sensitive data from your photos.
                Everything happens in your browser — nothing is uploaded.
              </p>
            </div>
          )}

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
              batchCleanControllerRef={batchCleanControllerRef}
            />
          </ErrorBoundary>

          {/* SEO Content & Comparison Guide */}
          <SeoContent />

          {/* Footer */}
          <footer className="text-center pt-8 pb-4">
            <p className="text-xs text-ink-400 dark:text-ink-600">
              PixelTruth v2.0.0 — Image Metadata Remover
            </p>
          </footer>
        </main>
      </div>
    </ErrorBoundary>
  );
}
