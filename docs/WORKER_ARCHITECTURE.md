# PixelTruth Web Worker Architecture

To keep the React UI responsive and fluid, PixelTruth offloads all CPU-bound image operations and metadata parsing to a Web Worker architecture.

## 1. The Worker Pool (`src/workers/pool.js`)

Tasks are managed by a bounded-concurrency `WorkerPool`:

*   **Bounded Concurrency**: Uses `navigator.hardwareConcurrency` to automatically determine safe worker limits (defaults to max 4 concurrent background threads).
*   **Timeouts and Resiliency**: If a worker hangs or encounters a fatal fault, the pool forcefully calls `terminate()` and recycles the worker to prevent deadlocks.
*   **Transferable Objects**: Explicitly relies on passing `ArrayBuffer` directly into and out of workers to eliminate copying heavy multi-megabyte payloads.
*   **Cancellation**: Integrated with `AbortSignal` / `AbortController` so removing a file from the queue or clearing the intake immediately cancels in-flight jobs.

## 2. Image Worker Pool (`imagePool`)

All image processing flows through a single pool instance (`imagePool` in `src/workers/instances.js`), executing `src/workers/image.worker.js`:

*   **`READ_METADATA`**: Invokes `exifr.parse` to extract GPS, IFD0, EXIF, and XMP payloads without decoding image pixels.
*   **`STRIP_METADATA`**: Executes lossless binary carving (`sanitizeImage`) preserving orientation and ICC color profiles. For selective JPEG stripping, utilizes `piexifjs` to manipulate EXIF segments natively.
*   **`GENERATE_THUMBNAIL`**: Generates safe thumbnail previews off the main thread, handling HEIC conversion via `heic2any` when needed.

## Protocol Lifecycle

1.  **START**: Main thread dispatches a request with an auto-incrementing ID and task payload.
2.  **PROGRESS**: Workers post granular stage updates (`VALIDATING`, `PARSING`, `CLEANING`, etc.) mapped to UI state chips.
3.  **COMPLETE / ERROR**: Worker returns the transferred `ArrayBuffer` or serialized error, resolving or rejecting the main thread promise.
