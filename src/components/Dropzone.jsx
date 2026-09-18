import { useCallback, useRef, useEffect } from 'react';
import toast from 'react-hot-toast';
import {
  inspectDimensions,
  ACCEPTED_TYPES,
  ACCEPTED_EXTENSIONS,
  MAX_FILE_SIZE,
  MAX_FILES,
} from '../utils/normalizeInput';

export default function Dropzone({ files, onFilesAdded }) {
  const inputRef = useRef(null);
  const dropRef = useRef(null);

  const processFiles = useCallback(
    async (rawFiles) => {
      const currentCount = files.length;
      const remaining = MAX_FILES - currentCount;

      if (remaining <= 0) {
        toast.error(`Maximum ${MAX_FILES} files allowed`);
        return;
      }

      const toProcess = Array.from(rawFiles).slice(0, remaining);
      if (toProcess.length < rawFiles.length) {
        toast(`Only ${remaining} more file${remaining === 1 ? '' : 's'} can be added`, {
          icon: '⚠️',
        });
      }

      const validFiles = [];

      for (const file of toProcess) {
        // Type check
        const typeOk = ACCEPTED_TYPES.includes(file.type) || ACCEPTED_EXTENSIONS.test(file.name);
        if (!typeOk) {
          toast.error(`"${file.name}" — unsupported format. Use JPEG, PNG, WebP, or HEIC.`);
          continue;
        }

        // Size check
        if (file.size > MAX_FILE_SIZE) {
          toast.error(`"${file.name}" exceeds 50 MB limit`);
          continue;
        }

        // Dimensions check
        const isSafe = await inspectDimensions(file);
        if (!isSafe) {
          toast.error(`"${file.name}" dimensions are too large (exceeds 64MP safe limit)`);
          continue;
        }

        // Keep the original file for all metadata reads to ensure completeness
        validFiles.push(file);
      }

      if (validFiles.length > 0) {
        onFilesAdded(validFiles);
      }
    },
    [files.length, onFilesAdded]
  );

  // Drag & drop handlers
  const handleDrag = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDragEnter = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    dropRef.current?.classList.add('drag-over');
  }, []);

  const handleDragLeave = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    dropRef.current?.classList.remove('drag-over');
  }, []);

  const handleDrop = useCallback(
    (e) => {
      e.preventDefault();
      e.stopPropagation();
      dropRef.current?.classList.remove('drag-over');
      if (e.dataTransfer.files?.length) {
        processFiles(e.dataTransfer.files);
      }
    },
    [processFiles]
  );

  // Clipboard paste
  useEffect(() => {
    const handlePaste = (e) => {
      const items = e.clipboardData?.items;
      if (!items) return;

      const imageFiles = [];
      for (const item of items) {
        if (item.kind === 'file' && item.type.startsWith('image/')) {
          const file = item.getAsFile();
          if (file) imageFiles.push(file);
        }
      }
      if (imageFiles.length > 0) {
        e.preventDefault();
        processFiles(imageFiles);
      }
    };

    document.addEventListener('paste', handlePaste);
    return () => document.removeEventListener('paste', handlePaste);
  }, [processFiles]);

  return (
    <div
      ref={dropRef}
      onDragOver={handleDrag}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onClick={() => inputRef.current?.click()}
      className="group relative glass-card p-8 sm:p-12 cursor-pointer transition-all duration-300 hover:shadow-xl hover:shadow-accent-500/10 hover:border-accent-300 dark:hover:border-accent-600 [&.drag-over]:border-accent-400 [&.drag-over]:bg-accent-50/50 dark:[&.drag-over]:bg-accent-900/20 [&.drag-over]:shadow-xl [&.drag-over]:shadow-accent-500/20"
      id="dropzone"
    >
      <input
        ref={inputRef}
        type="file"
        multiple
        accept=".jpg,.jpeg,.png,.webp,.heic,.heif"
        className="hidden"
        onChange={(e) => {
          if (e.target.files?.length) processFiles(e.target.files);
          e.target.value = '';
        }}
      />

      <div className="flex flex-col items-center gap-4 text-center">
        {/* Upload icon */}
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-accent-100 to-accent-200 dark:from-accent-900/40 dark:to-accent-800/40 flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-accent-600 dark:text-accent-400">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="17 8 12 3 7 8" />
            <line x1="12" y1="3" x2="12" y2="15" />
          </svg>
        </div>

        <div>
          <p className="text-lg font-semibold text-surface-800 dark:text-surface-200">
            Drop images here or{' '}
            <span className="text-accent-600 dark:text-accent-400 underline decoration-accent-300 dark:decoration-accent-600 underline-offset-2">
              browse
            </span>
          </p>
          <p className="mt-1.5 text-sm text-surface-500 dark:text-surface-400">
            JPEG, PNG, WebP, HEIC — up to 20 files, 50 MB each
          </p>
          <p className="mt-1 text-xs text-surface-400 dark:text-surface-500">
            You can also paste images from your clipboard (Ctrl+V)
          </p>
        </div>

        {/* HEIC note */}
        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 text-xs font-medium">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="16" x2="12" y2="12" />
            <line x1="12" y1="8" x2="12.01" y2="8" />
          </svg>
          HEIC files are converted to JPEG before processing
        </div>
      </div>
    </div>
  );
}
