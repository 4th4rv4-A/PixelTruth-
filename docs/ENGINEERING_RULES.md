# PixelTruth Engineering Rules

## Core Principles
1. **Preserve existing working functionality.** Do not change working logic unless fixing a verified bug or architectural flaw.
2. **Avoid broad rewrites unless necessary.** Target specific bottlenecks (e.g., moving processing to workers) rather than rewriting the entire React application state.
3. **Prefer deterministic processing over heuristic behavior.**
4. **Keep provenance claims conservative.** Never call the absence of evidence "proof of absence."
5. **Never label an image "real" merely because it has no AI indicators.**
6. **Never claim an AI probability is ground truth.**
7. **Preserve original image pixels whenever metadata-only cleaning is requested** (and technically possible, e.g., selective JPEG stripping).
8. **Never trust file extensions or supplied MIME types alone.** Always validate content safely.
9. **Bound memory and processing time.** Establish upper limits for dimensions, file size, and execution time.
10. **Heavy processing should move off the main thread.** Image re-encoding, EXIF manipulation, and WASM-heavy tasks must use Web Workers.
11. **Every worker/task must have an explicit lifecycle.** They must start, report progress/errors, and be cleanly terminated or garbage collected.
12. **Every asynchronous job must have cancellation/error handling.** (e.g. AbortController).
13. **Do not leak user image contents through logging or telemetry.** Console logging should never output image data buffers, base64 strings, or exact GPS coordinates in production.
14. **Do not expose internal debugging APIs in production.** Remove any `window.__debug` hooks before deployment.
15. **Do not introduce unnecessary third-party network calls.** The application must remain functional without an internet connection (aside from PWA installation / initial load). No analytics, no cloud APIs.
