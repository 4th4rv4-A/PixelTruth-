# PixelTruth Automated Test Suite

This document describes the automated testing infrastructure for PixelTruth, verifying security, lossless byte preservation, orientation/color handling, performance, and accessibility.

## Test Layers

### 1. Unit & Invariant Tests (`npm run test`)
Powered by **Vitest**, all 8 test suites (94 total tests) run in under 1 second:

- **Binary Carver & Invariants (`binarySanitizer.test.js`)**:
  - Asserts that JPEG stripping preserves `Orientation` (`0x0112`) via fresh direct byte APP1 generation.
  - Verifies that GPS, camera make/model, and timestamp metadata are removed while `SOS` -> `EOI` pixel bytes remain byte-for-byte identical (`deepEqual`).
  - Verifies default policy retains ICC profiles (`APP2`), while `Full Sanitize` removes them.
  - Asserts that JPEGs without orientation data do not receive empty APP1 segments.
  - Asserts PNG ancillary chunk stripping and WebP chunk rewriting without altering pixel bitstreams.
- **Header Safety & Format Intake (`fileValidator.test.js`)**:
  - Validates dimension parsing and container safety across JPEG (SOF), PNG (IHDR), HEIC (BMFF `ispe`), GIF (logical screen descriptor for GIF87a/89a), and AVIF (`ftyp` brands + `ispe`).
  - Enforces 50 MB file size limit, 64 MP decompression limit, and 500 MB memory estimation limit.
- **Metadata Extraction & Whitelist Sync (`readMetadata.test.js`)**:
  - Validates tag extraction and shared preserved tag whitelist (`PRESERVED_TAGS_BY_MIME`, `ALWAYS_KEEP_TAGS`).
- **Archive & Download Utilities (`zipDownload.test.js`)**:
  - Validates single-file download triggers and bulk ZIP creation via JSZip.
- **Queue & Intake Validation (`sizeAndHeic.test.js`, `normalizeInput.test.js`, `rapidImport.test.js`)**:
  - Asserts file limit (20 files), concurrency safety, and HEIC thumbnail offloading.

### 2. End-to-End Tests (`npm run test:e2e`)
Powered by **Playwright**:

- **Core Flows (`tests/e2e/core-flows.spec.js`)**: Upload files, file queue interactions, per-file remove, bulk clean, and ZIP download.
- **Accessibility (`tests/e2e/a11y.spec.js`)**: Automated axe scans using `@axe-core/playwright` on the single-page application across three states: initial load, file queued, and post-clean completion.
- **Performance Telemetry (`tests/e2e/performance.spec.js`)**: Shell load and worker initialization timings.

> [!NOTE]
> **Environment Limitation**: In restricted sandbox environments where external browser binaries cannot be installed (`~/.cache/ms-playwright` empty and CDN blocked), running `npm run test:e2e` will report missing browsers. E2E tests are targeted to run in standard CI environments where browsers can be downloaded.

## Running Tests

**Run unit test suite:**
```bash
npm test
```

**Run linter (oxlint):**
```bash
npm run lint
```

**Run build:**
```bash
npm run build
```
