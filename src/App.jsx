import { useState, useCallback } from 'react';
import { Toaster } from 'react-hot-toast';
import Header from './components/Header';
import Dropzone from './components/Dropzone';
import FileQueue from './components/FileQueue';
import CleanButton from './components/CleanButton';
import DetectDropzone from './components/DetectDropzone';
import VerdictCard from './components/VerdictCard';
import InstallPrompt from './components/InstallPrompt';
import ErrorBoundary from './components/ErrorBoundary';
import { readMetadata, getPrivacyLevel } from './utils/readMetadata';
import { detectAI } from './utils/detectAI';

let fileIdCounter = 0;

export default function App() {
  const [activeTab, setActiveTab] = useState('clean');

  // ─── Clean tab state (isolated) ──────────────────────
  const [cleanFiles, setCleanFiles] = useState([]);

  // ─── Detect tab state (isolated) ─────────────────────
  const [detectFiles, setDetectFiles] = useState([]);

  /* ════════════════════════════════════════════════════
   *  CLEAN TAB HANDLERS
   * ════════════════════════════════════════════════════ */

  const handleCleanFilesAdded = useCallback(async (newFiles) => {
    const pendingItems = newFiles.map((file) => ({
      id: `clean-${++fileIdCounter}`,
      file,
      thumbnailUrl: URL.createObjectURL(file),
      metadata: null,
      privacyLevel: 'low',
      keepTags: [],
    }));

    setCleanFiles((prev) => [...prev, ...pendingItems]);

    for (const item of pendingItems) {
      try {
        const metadata = await readMetadata(item.file);
        const privacyLevel = getPrivacyLevel(metadata);
        setCleanFiles((prev) =>
          prev.map((f) =>
            f.id === item.id ? { ...f, metadata, privacyLevel } : f
          )
        );
      } catch {
        setCleanFiles((prev) =>
          prev.map((f) =>
            f.id === item.id ? { ...f, metadata: {}, privacyLevel: 'low' } : f
          )
        );
      }
    }
  }, []);

  const handleCleanRemoveFile = useCallback((id) => {
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

  const handleDetectFilesAdded = useCallback(async (newFiles) => {
    const pendingItems = newFiles.map((file) => ({
      id: `detect-${++fileIdCounter}`,
      file,
      thumbnailUrl: URL.createObjectURL(file),
      result: null, // null = analyzing
    }));

    setDetectFiles((prev) => [...prev, ...pendingItems]);

    for (const item of pendingItems) {
      try {
        const result = await detectAI(item.file);
        setDetectFiles((prev) =>
          prev.map((f) => (f.id === item.id ? { ...f, result } : f))
        );
      } catch (err) {
        console.error('Detection failed for', item.file.name, err);
        setDetectFiles((prev) =>
          prev.map((f) =>
            f.id === item.id
              ? { ...f, result: { verdict: 'inconclusive' } }
              : f
          )
        );
      }
    }
  }, []);

  const handleDetectRemoveFile = useCallback((id) => {
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

            <ErrorBoundary onReset={() => setCleanFiles([])}>
              <Dropzone files={cleanFiles} onFilesAdded={handleCleanFilesAdded} />

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

            <ErrorBoundary onReset={() => setDetectFiles([])}>
              <DetectDropzone files={detectFiles} onFilesAdded={handleDetectFilesAdded} />

              {/* Detect results */}
              {detectFiles.length > 0 && (
                <div className="space-y-4">
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

        {/* Footer */}
        <footer className="text-center pt-8 pb-4">
          <p className="text-xs text-surface-400 dark:text-surface-600">
            PixelTruth v2.0 — Metadata Cleaner & AI Detection
          </p>
        </footer>
      </main>
    </div>
    </ErrorBoundary>
  );
}
