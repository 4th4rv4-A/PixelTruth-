# PixelTruth Automated Test Suite

This document describes the automated testing infrastructure for PixelTruth, designed to prevent regressions across security, core functionality, performance, and accessibility.

## Test Layers

### 1. Unit & Invariant Tests (`npm run test`)
Powered by **Vitest**, these tests run near-instantly and cover:
- **Binary Parsers**: Validates JPEG, PNG, and WebP segment routing and removal logic.
- **Regression Invariants**: Explicit assertions guarantee that *when metadata is removed, the remaining image data is preserved byte-for-byte*.
- **Verdict Engine**: Validates the aggregation logic for AI and Provenance signals.
- **Adversarial Resiliency**: Feeds truncated, malformed, and out-of-bounds byte arrays into the parsers to ensure they fail gracefully rather than crashing or allocating unbounded memory.

### 2. End-to-End Browser Tests (`npm run test:e2e`)
Powered by **Playwright**, these tests boot a local browser and perform realistic user flows:
- **Core Flows (`core-flows.spec.js`)**: Automates uploading files, interacting with the file queue, testing max-file boundaries, initiating batch cleans, and downloading ZIP results.
- **Forensic Inspector (`inspector.spec.js`)**: Tests the report generation, worker message passing, and UI transitions.
- **Performance Telemetry (`performance.spec.js`)**: Establishes rough assertions for the initial app shell load and worker initialization.

### 3. Accessibility Checks (`npm run test:e2e`)
Using **@axe-core/playwright** embedded in the E2E suite (`a11y.spec.js`), the application is automatically scanned for WCAG violations including contrast, ARIA labels, and focus ordering.

## Fixtures & Test Data
To keep the Git repository small, we **do not check in binary image files**.
Instead, we procedurally generate byte-perfect minimal valid and malformed JPEGs/PNGs via a script.
**Run:**
```bash
node tests/fixtures/generate.js
```
This drops the test data into `tests/fixtures/generated/` (which is ignored by Git).

## Running Tests

**Run all fast unit tests:**
```bash
npm run test
```

**Run End-to-End tests (Requires Playwright browsers):**
```bash
# Ensure dev server is not already running on port 5173
npm run test:e2e
```

**Run all tests (CI Pipeline Equivalent):**
```bash
npm run test:ci
```
