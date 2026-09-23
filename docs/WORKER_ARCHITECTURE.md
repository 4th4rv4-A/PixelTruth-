# PixelTruth Web Worker Architecture

To prevent CPU-intensive image processing tasks from freezing the main thread and janking the React UI, PixelTruth offloads heavy workloads to a scalable, isolated Web Worker architecture.

## 1. The Worker Pool (`src/workers/pool.js`)
Rather than spinning up arbitrary Web Workers per request (which causes severe context-switching overhead and memory spikes), all tasks are routed through a generic, bounded-concurrency `WorkerPool`.

*   **Bounded Concurrency**: Uses `navigator.hardwareConcurrency` to automatically determine safe worker limits. Defaults to max 4 concurrent background threads.
*   **Timeouts and Resiliency**: If a worker hangs (e.g. infinite loop in a WASM runtime or memory fault), the pool forcefully `terminate()`s the thread and recycles it to prevent deadlocks.
*   **Transferable Objects**: Explicitly relies on passing `ArrayBuffer` directly into and out of workers to eliminate copying heavy multimegabyte blobs.
*   **Cancellation**: AbortSignal integration means navigating away or removing a file instantly aborts pending jobs.

## 2. Image Worker (`image.worker.js`)
Responsible for general image processing pipelines:
*   **`READ_METADATA`**: Invokes `exifr.parse` to extract GPS, IFD0, EXIF, and XMP payloads without decoding image pixels.
*   **`STRIP_METADATA`**: Runs the binary stripping logic (`sanitizeImage`) first. If selective piexif tagging or heavy pixel manipulations (like canvas fallback) are required, relies on the `OffscreenCanvas` API. Also natively runs `heic2any` to convert unsupported iOS containers transparently in the background.

## 3. C2PA Worker (`c2pa.worker.js`)
Responsible exclusively for cryptographic provenance validation.
*   **`DETECT_AI`**: Initializes the `@contentauth/c2pa-web/inline` WASM binary. Because initialization is expensive, the module is instantiated once per worker thread and held in a singleton closure. Analyzes manifest assertions and ingredients completely asynchronously.

## Protocol Lifecycle
1.  **START**: Main thread dispatches a request with an auto-incrementing ID.
2.  **PROGRESS**: Workers periodically dispatch granular status updates (`VALIDATING`, `PARSING`, `CLEANING`, etc.) mapped to the UI.
3.  **COMPLETE / ERROR**: Worker returns the transferred `ArrayBuffer` or a serialized error string, which resolves/rejects the original `Promise` on the main thread.
