# PixelTruth Production Roadmap

## 1. Current Architecture
PixelTruth is a 100% browser-native web application built with React 19, Vite, and Tailwind CSS.
- **UI Layer**: React components handling state natively without external state managers.
- **Image Processing Layer**: Synchronous and asynchronous operations on the main thread using HTML Canvas for full metadata stripping and `heic2any` for format conversion.
- **Metadata Layer**: Uses `exifr` for parsing and `piexifjs` for selective metadata modification.
- **C2PA/AI Detection Layer**: Relies on `@contentauth/c2pa-web` (loaded dynamically) for provenance verification and heuristics on EXIF tags.
- **Export Layer**: `JSZip` and `file-saver` for bulk downloads.

## 2. Current Strengths
- **Privacy-First**: No external network requests for processing; fully client-side.
- **Robust Validation gating**: File size and dimensional checks mitigate simple decompression bombs. C2PA claims are strictly gated on valid/trusted states.
- **Excellent Test Coverage**: Baseline Vitest tests are passing with good coverage for critical utility functions.
- **No Build Errors**: ESLint (Oxlint) and Vite builds pass successfully out of the box.

## 3. P0 Blockers
- **Main-Thread Blocking (Image Processing)**: Generating Canvas outputs for full stripping, editing EXIF, and converting HEIC images runs on the main thread. Batch processing (up to 20 images) will cause significant UI freezing and "Page Unresponsive" errors. Processing *must* be moved to Web Workers.
- **Concurrent Memory Pressure (Thumbnails)**: `handleCleanFilesAdded` triggers concurrent `heic2any` conversions via `Promise.all` for up to 20 files. HEIC conversion is extremely memory intensive and will crash mobile browsers.

## 4. P1 Improvements
- **C2PA WASM Lifecycle Management**: Ensure that `reader.free()` and WASM memory are completely cleared during repeated bulk processing to prevent memory leaks over time.
- **Strict MIME Type & Extension Spoofing Safeguards**: Better validation of file magic numbers before passing to `exifr` or `heic2any` to prevent malicious payloads from crashing the parser.
- **Cancellation of Async Tasks**: Currently, if a user removes a file from the queue while it's being analyzed or cleaned, the background tasks continue consuming resources.

## 5. P2 Improvements
- **Content Security Policy (CSP)**: Establish strict CSP headers to actively prevent external network calls or data exfiltration (rather than just relying on the absence of such code).
- **Service Worker Caching Limits**: Refine Workbox configurations to gracefully handle storage quota limits on constrained devices.

## 6. P3 Future Features
- Local WebGL or WebGPU acceleration for image processing/resizing.
- Support for more input formats (e.g., AVIF) and granular output encoding settings (quality sliders).
- Dedicated local-only on-device ML models via ONNX Runtime Web for visual AI detection without cloud APIs.

## 7. Dependency Risks
- `heic2any` and `piexifjs` have not been updated recently; `piexifjs` only supports JPEG, creating a fragmented logic path depending on image format.
- `@contentauth/c2pa-web` is large (11MB chunk in production build) and relies heavily on WASM, creating a potential memory overhead and slower initialization time.

## 8. Performance Risks
- Converting high-megapixel images (e.g. 50MP from modern phones) on mobile devices using JavaScript-based HEIC conversion and HTML Canvas re-encoding is extremely slow and memory intensive.

## 9. Security Risks
- Although `exifr` and the C2PA SDK are robust, parsing complex binary formats in JS/WASM always carries some risk of infinite loops or crashes (DOS). Memory limits are currently set, but strict timeouts on parsing should also be enforced.

## 10. Test Gaps
- Lack of E2E tests for the main UI flows (batch processing, drag-and-drop).
- No Web Worker tests (once workers are implemented).
- Missing memory-leak regression tests for C2PA instantiation.

## 11. Recommended Implementation Order
1. **P0**: Architect a Web Worker pool for `stripMetadata.js` and `heic2any` processing.
2. **P0**: Implement a concurrency limiter (queue) for thumbnail generation to prevent concurrent HEIC conversion crashes.
3. **P1**: Add cancellation tokens (AbortController) to all image processing and detection tasks.
4. **P1**: Implement strict binary magic-number validation.
5. **P2**: Apply strict CSP configurations.
