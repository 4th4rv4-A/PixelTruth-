import { useState, useCallback, useRef, useEffect } from 'react';
import { Toaster } from 'react-hot-toast';
import toast from 'react-hot-toast';
import Header from './components/Header';
import Dropzone from './components/Dropzone';
import FileQueue from './components/FileQueue';
import CleanButton from './components/CleanButton';
import InstallPrompt from './components/InstallPrompt';
import ErrorBoundary from './components/ErrorBoundary';
import { createSafeThumbnail, MAX_FILES } from './utils/normalizeInput';
import { readMetadata, getPrivacyLevel } from './utils/readMetadata';

let fileIdCounter = 0;

export default function App() {
  // ─── File state ──────────────────────────────────────
  const [cleanFiles, setCleanFiles] = useState([]);
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
    // Clamp to available slots in case called directly
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

    for (const item of allowedItems) {
      const controller = new AbortController();
      abortControllersRef.current.set(item.id, controller);
      
      try {
        const metadata = await readMetadata(item.file, controller.signal);
        const privacyLevel = getPrivacyLevel(metadata);
        
        setCleanFiles((prev) =>
          prev.map((f) =>
            f.id === item.id ? { ...f, metadata, privacyLevel } : f
          )
        );
      } catch (err) {
        if (err.message !== 'CANCELLED') {
          setCleanFiles((prev) =>
            prev.map((f) =>
              f.id === item.id ? { ...f, metadata: {}, privacyLevel: 'low' } : f
            )
          );
        }
      } finally {
        abortControllersRef.current.delete(item.id);
      }
    }
  }, []);

  const handleCleanRemoveFile = useCallback((id) => {
    // Abort if currently processing
    const controller = abortControllersRef.current.get(id);
    if (controller) {
      controller.abort();
      abortControllersRef.current.delete(id);
    }
    
    setCleanFiles((prev) => {
      const item = prev.find((f) => f.id === id);
      if (item?.thumbnailUrl) URL.revokeObjectURL(item.thumbnailUrl);
      return prev.filter((f) => f.id !== id);
    });
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

        <ErrorBoundary onReset={() => {
          cleanFiles.forEach(f => { if (f.thumbnailUrl) URL.revokeObjectURL(f.thumbnailUrl); });
          setCleanFiles([]);
        }}>
          <Dropzone
            files={cleanFiles}
            onFilesAdded={handleCleanFilesAdded}
            onReserveSlots={reserveCleanSlots}
            onReleaseSlots={releaseCleanSlots}
          />

          <FileQueue
            files={cleanFiles}
            onRemoveFile={handleCleanRemoveFile}
            onToggleTag={handleToggleTag}
          />

          <CleanButton files={cleanFiles} />
        </ErrorBoundary>

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
