import { useCallback, useRef, useEffect } from 'react';
import toast from 'react-hot-toast';
import {
  validateFile,
  MAX_FILES,
} from '../utils/normalizeInput';

export default function DetectDropzone({ files, onFilesAdded, onReserveSlots, onReleaseSlots }) {
  const inputRef = useRef(null);
  const dropRef = useRef(null);

  const reserve = useCallback(
    (count) => {
      if (onReserveSlots) return onReserveSlots(count);
      const remaining = Math.max(0, MAX_FILES - files.length);
      return { accepted: Math.min(count, remaining), available: remaining };
    },
    [files.length, onReserveSlots]
  );

  const release = useCallback(
    (count) => {
      if (onReleaseSlots) onReleaseSlots(count);
    },
    [onReleaseSlots]
  );

  const processFiles = useCallback(
    async (rawFiles) => {
      const rawList = Array.from(rawFiles);
      const { accepted } = reserve(rawList.length);

      if (accepted <= 0) {
        toast.error(`Maximum ${MAX_FILES} files allowed`);
        return;
      }

      if (accepted < rawList.length) {
        toast(`Only ${accepted} more file${accepted === 1 ? '' : 's'} can be added`, {
          icon: '⚠️',
        });
      }

      const toProcess = rawList.slice(0, accepted);
      const validFiles = [];

      for (const file of toProcess) {
        // Validation pipeline
        const result = await validateFile(file);
        
        if (!result.valid) {
          const reason = result.reasons[0];
          if (reason === 'FILE_TOO_LARGE') toast.error(`"${file.name}" exceeds 50 MB limit`);
          else if (reason === 'INVALID_SIGNATURE') toast.error(`"${file.name}" — unsupported format. Use JPEG, PNG, WebP, or HEIC.`);
          else if (reason === 'UNSUPPORTED_FORMAT') toast.error(`"${file.name}" is an unsupported format.`);
          else if (reason === 'DIMENSIONS_UNKNOWN') toast.error(`"${file.name}" dimensions could not be safely verified.`);
          else if (reason === 'PIXEL_LIMIT_EXCEEDED') toast.error(`"${file.name}" dimensions are too large (exceeds 64MP safe limit).`);
          else if (reason === 'ESTIMATED_MEMORY_EXCEEDED') toast.error(`"${file.name}" requires too much memory to decode safely.`);
          else if (reason === 'METADATA_TOO_LARGE') toast.error(`"${file.name}" contains unusually large metadata blocks.`);
          else if (reason === 'MALFORMED_CONTAINER') toast.error(`"${file.name}" has a malformed structure.`);
          else toast.error(`"${file.name}" was rejected for security reasons.`);
          release(1);
          continue;
        }

        validFiles.push(file);
      }

      if (validFiles.length > 0) {
        onFilesAdded(validFiles);
      }
    },
    [reserve, release, onFilesAdded]
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
      className="group relative frame border-dashed border-ink-400 p-8 sm:p-12 cursor-pointer transition-all duration-300 [&.drag-over]:border-solid [&.drag-over]:border-safelight-500 [&.drag-over]:bg-safelight-500/5 focus:outline-none focus:ring-2 focus:ring-safelight-500 focus:ring-offset-2 dark:focus:ring-offset-ink-950"
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
        <div className="w-16 h-16 rounded-sm bg-ink-100 dark:bg-ink-800 flex items-center justify-center">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-ink-400">
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.3-4.3" />
            <path d="M11 8v6" />
            <path d="M8 11h6" />
          </svg>
        </div>

        <div>
          <p className="text-lg font-semibold text-ink-800 dark:text-ink-200">
            Drop images to inspect for AI markers
          </p>
          <p className="mt-1.5 text-sm text-ink-500 dark:text-ink-400">
            Checks C2PA Content Credentials and software metadata tags
          </p>
          <p className="mt-1 text-xs text-ink-400 dark:text-ink-500">
            JPEG, PNG, WebP, HEIC — up to 20 files, 50 MB each
          </p>
        </div>

        {/* Disclaimer */}
        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-sm bg-ink-100 dark:bg-ink-800 text-ink-500 dark:text-ink-400 text-xs font-medium">
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
