import { useCallback, useRef, useEffect } from 'react';
import toast from 'react-hot-toast';
import {
  inspectDimensions,
  ACCEPTED_TYPES,
  ACCEPTED_EXTENSIONS,
  MAX_FILE_SIZE,
  MAX_FILES,
} from '../utils/normalizeInput';

export default function DetectDropzone({ files, onFilesAdded }) {
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
        const typeOk = ACCEPTED_TYPES.includes(file.type) || ACCEPTED_EXTENSIONS.test(file.name);
        if (!typeOk) {
          toast.error(`"${file.name}" — unsupported format. Use JPEG, PNG, WebP, or HEIC.`);
          continue;
        }

        if (file.size > MAX_FILE_SIZE) {
          toast.error(`"${file.name}" exceeds 50 MB limit`);
          continue;
        }

        const dimResult = await inspectDimensions(file);
        if (!dimResult.safe) {
          if (dimResult.reason === 'oversized') {
            toast.error(`"${file.name}" dimensions are too large (exceeds 64MP safe limit)`);
          } else {
            toast.error(`"${file.name}" is too large or its dimensions couldn't be verified safely.`);
          }
          continue;
        }

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
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          inputRef.current?.click();
        }
      }}
      role="button"
      tabIndex={0}
      aria-label="Upload images for AI detection. Drop files or press Enter to browse."
      className="group relative glass-card p-8 sm:p-12 cursor-pointer transition-all duration-300 hover:shadow-xl hover:shadow-violet-500/10 hover:border-violet-300 dark:hover:border-violet-600 [&.drag-over]:border-violet-400 [&.drag-over]:bg-violet-50/50 dark:[&.drag-over]:bg-violet-900/20 [&.drag-over]:shadow-xl [&.drag-over]:shadow-violet-500/20 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:ring-offset-2 dark:focus:ring-offset-surface-950"
      id="detect-dropzone"
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
        {/* Detect icon */}
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-violet-100 to-violet-200 dark:from-violet-900/40 dark:to-violet-800/40 flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-violet-600 dark:text-violet-400">
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.3-4.3" />
            <path d="M11 8v6" />
            <path d="M8 11h6" />
          </svg>
        </div>

        <div>
          <p className="text-lg font-semibold text-surface-800 dark:text-surface-200">
            Drop images to inspect for AI markers
          </p>
          <p className="mt-1.5 text-sm text-surface-500 dark:text-surface-400">
            Checks C2PA Content Credentials and software metadata tags
          </p>
          <p className="mt-1 text-xs text-surface-400 dark:text-surface-500">
            JPEG, PNG, WebP, HEIC — up to 20 files, 50 MB each
          </p>
        </div>

        {/* Disclaimer */}
        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-surface-100 dark:bg-surface-800 text-surface-500 dark:text-surface-400 text-xs font-medium">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="16" x2="12" y2="12" />
            <line x1="12" y1="8" x2="12.01" y2="8" />
          </svg>
          Metadata-based only — cannot detect visual AI artifacts
        </div>
      </div>
    </div>
  );
}
