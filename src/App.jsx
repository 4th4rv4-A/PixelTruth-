import { useState, useCallback, useRef, useEffect } from 'react';
import { Toaster } from 'react-hot-toast';
import toast from 'react-hot-toast';
import Header from './components/Header';
import Dropzone from './components/Dropzone';
import FileQueue from './components/FileQueue';
import CleanButton from './components/CleanButton';
import DetectDropzone from './components/DetectDropzone';
import VerdictCard from './components/VerdictCard';
import InstallPrompt from './components/InstallPrompt';
import ErrorBoundary from './components/ErrorBoundary';
import { detectAI } from './utils/detectAI';
import { createSafeThumbnail, MAX_FILES } from './utils/normalizeInput';
import { readMetadata, getPrivacyLevel } from './utils/readMetadata';
import InspectorView from './components/InspectorView';
import WorkspaceView from './components/WorkspaceView';

let fileIdCounter = 0;

export default function App() {
  const [activeTab, setActiveTab] = useState('clean');

  // ─── Clean tab state (isolated) ──────────────────────
  const [cleanFiles, setCleanFiles] = useState([]);
  const cleanFilesRef = useRef([]);
  const cleanInFlightRef = useRef(0);

  useEffect(() => {
    cleanFilesRef.current = cleanFiles;
  }, [cleanFiles]);

  // ─── Detect tab state (isolated) ─────────────────────
  const [detectFiles, setDetectFiles] = useState([]);
  const detectFilesRef = useRef([]);
  const detectInFlightRef = useRef(0);

  useEffect(() => {
    detectFilesRef.current = detectFiles;
  }, [detectFiles]);

  // ─── Inspect tab state (isolated) ────────────────────
  const [inspectFile, setInspectFile] = useState(null);

  // Controllers for background tasks
  const abortControllersRef = useRef(new Map());

  // Cleanup object URLs and pending tasks on unmount
  useEffect(() => {
    const controllers = abortControllersRef.current;
    return () => {
      cleanFilesRef.current.forEach((item) => {
        if (item.thumbnailUrl) URL.revokeObjectURL(item.thumbnailUrl);
      });
      detectFilesRef.current.forEach((item) => {
        if (item.thumbnailUrl) URL.revokeObjectURL(item.thumbnailUrl);
      });
      for (const controller of controllers.values()) {
        controller.abort();
      }
      controllers.clear();
    };
  }, []);

  /* ════════════════════════════════════════════════════
   *  CLEAN TAB HANDLERS
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

  /* ════════════════════════════════════════════════════
   *  DETECT TAB HANDLERS
   * ════════════════════════════════════════════════════ */

  const reserveDetectSlots = useCallback((count) => {
    const total = detectFilesRef.current.length + detectInFlightRef.current;
    const available = Math.max(0, MAX_FILES - total);
    const accepted = Math.min(count, available);
    detectInFlightRef.current += accepted;
    return { accepted, available };
  }, []);

  const releaseDetectSlots = useCallback((count) => {
    detectInFlightRef.current = Math.max(0, detectInFlightRef.current - count);
  }, []);

  const handleDetectFilesAdded = useCallback(async (newFiles) => {
    const availableSlots = Math.max(0, MAX_FILES - detectFilesRef.current.length);
    const filesToAccept = newFiles.slice(0, availableSlots);

    if (filesToAccept.length === 0) {
      toast.error(`Maximum ${MAX_FILES} files allowed`);
      return;
    }

    const pendingItems = await Promise.all(
      filesToAccept.map(async (file) => ({
        id: `detect-${++fileIdCounter}`,
        file,
        thumbnailUrl: await createSafeThumbnail(file),
        result: null, // null = analyzing
      }))
    );

    const allowedItems = pendingItems;
    setDetectFiles((prev) => {
      const remaining = Math.max(0, MAX_FILES - prev.length);
      const itemsToAdd = allowedItems.slice(0, remaining);
      const dropped = allowedItems.slice(remaining);
      dropped.forEach((item) => {
        if (item.thumbnailUrl) URL.revokeObjectURL(item.thumbnailUrl);
      });
      detectInFlightRef.current = Math.max(0, detectInFlightRef.current - filesToAccept.length);
      return [...prev, ...itemsToAdd];
    });

    for (const item of allowedItems) {
      const controller = new AbortController();
      abortControllersRef.current.set(item.id, controller);

      try {
        const result = await detectAI(item.file, controller.signal);
        setDetectFiles((prev) =>
          prev.map((f) => (f.id === item.id ? { ...f, result } : f))
        );
      } catch (err) {
        if (err.message !== 'CANCELLED') {
          toast.error(`Detection failed for "${item.file.name}": ${err.message || 'Unknown error'}`);
          setDetectFiles((prev) =>
            prev.map((f) =>
              f.id === item.id
                ? { ...f, result: { verdict: 'inconclusive' } }
                : f
            )
          );
        }
      } finally {
        abortControllersRef.current.delete(item.id);
      }
    }
  }, []);

  const handleDetectRemoveFile = useCallback((id) => {
    const controller = abortControllersRef.current.get(id);
    if (controller) {
      controller.abort();
      abortControllersRef.current.delete(id);
    }

    setDetectFiles((prev) => {
      const item = prev.find((f) => f.id === id);
      if (item?.thumbnailUrl) URL.revokeObjectURL(item.thumbnailUrl);
      return prev.filter((f) => f.id !== id);
    });
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

      <Header activeTab={activeTab} onTabChange={setActiveTab} />

      <main className="flex-1 max-w-4xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        {/* ═══ CLEAN TAB ═══ */}
        {activeTab === 'clean' && (
          <>
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
          </>
        )}

        {/* ═══ DETECT TAB ═══ */}
        {activeTab === 'detect' && (
          <>
            <div className="text-center space-y-2 mb-2">
              <h2 className="text-2xl sm:text-3xl font-bold text-surface-900 dark:text-white">
                Detect AI-generated images
              </h2>
              <p className="text-surface-500 dark:text-surface-400 max-w-lg mx-auto">
                Inspect C2PA Content Credentials and software metadata to identify AI-generated images.
                No visual analysis — metadata-based detection only.
              </p>
            </div>

            <ErrorBoundary onReset={() => {
              detectFiles.forEach(f => { if (f.thumbnailUrl) URL.revokeObjectURL(f.thumbnailUrl); });
              setDetectFiles([]);
            }}>
              <DetectDropzone
                files={detectFiles}
                onFilesAdded={handleDetectFilesAdded}
                onReserveSlots={reserveDetectSlots}
                onReleaseSlots={releaseDetectSlots}
              />

              {/* Detect results */}
              {detectFiles.length > 0 && (
                <div className="space-y-4" role="region" aria-live="polite" aria-label="Detection results">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-semibold text-surface-800 dark:text-surface-200">
                        Results
                      </h3>
                      <span className="px-2 py-0.5 rounded-full bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-400 text-xs font-bold">
                        {detectFiles.length}
                      </span>
                    </div>
                    <button
                      onClick={() => {
                        detectFiles.forEach((f) => {
                          if (f.thumbnailUrl) URL.revokeObjectURL(f.thumbnailUrl);
                        });
                        setDetectFiles([]);
                      }}
                      className="text-xs text-surface-400 hover:text-red-500 dark:text-surface-500 dark:hover:text-red-400 transition-colors"
                      aria-label="Clear all detection results"
                    >
                      Clear all
                    </button>
                  </div>

                  {detectFiles.map((item) => (
                    <div key={item.id} className="relative group">
                      <VerdictCard item={item} />
                      <button
                        onClick={() => handleDetectRemoveFile(item.id)}
                        className="absolute top-3 right-3 w-8 h-8 rounded-lg flex items-center justify-center text-surface-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors opacity-0 group-hover:opacity-100"
                        aria-label={`Remove ${item.file.name}`}
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <line x1="18" y1="6" x2="6" y2="18" />
                          <line x1="6" y1="6" x2="18" y2="18" />
                        </svg>
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </ErrorBoundary>
          </>
        )}

        {/* ═══ INSPECT TAB ═══ */}
        {activeTab === 'inspect' && (
          <>
            <div className="text-center space-y-2 mb-2">
              <h2 className="text-2xl sm:text-3xl font-bold text-surface-900 dark:text-white">
                Forensic Inspector
              </h2>
              <p className="text-surface-500 dark:text-surface-400 max-w-lg mx-auto">
                Deep dive into the binary structure, metadata ledger, and cryptographic provenance of your image. Advanced analysis only.
              </p>
            </div>

            <ErrorBoundary onReset={() => setInspectFile(null)}>
              {!inspectFile ? (
                <Dropzone
                  files={[]}
                  onFilesAdded={(newFiles) => {
                    if (newFiles.length > 0) setInspectFile(newFiles[0]);
                  }}
                  onReserveSlots={() => ({ accepted: 1, available: 1 })}
                  onReleaseSlots={() => {}}
                />
              ) : (
                <div className="space-y-4">
                  <div className="flex justify-end">
                    <button
                      onClick={() => setInspectFile(null)}
                      className="px-4 py-2 bg-surface-800 hover:bg-surface-700 text-surface-200 rounded-lg text-sm font-medium transition-colors"
                    >
                      Inspect Another File
                    </button>
                  </div>
                  <InspectorView file={inspectFile} />
                </div>
              )}
            </ErrorBoundary>
          </>
        )}

        {/* ═══ WORKSPACE TAB ═══ */}
        {activeTab === 'workspace' && (
          <ErrorBoundary onReset={() => setActiveTab('clean')}>
            <WorkspaceView />
          </ErrorBoundary>
        )}

        {/* Footer */}
        <footer className="text-center pt-8 pb-4">
          <p className="text-xs text-surface-400 dark:text-surface-600">
            PixelTruth v2.0.0 — Metadata Cleaner & AI Detection
          </p>
        </footer>
      </main>
    </div>
    </ErrorBoundary>
  );
}
