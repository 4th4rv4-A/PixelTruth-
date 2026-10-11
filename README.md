# PixelTruth

A browser-native image metadata and EXIF remover. Inspect metadata, strip sensitive tags losslessly at the byte level, and download cleaned files individually or as a ZIP archive — 100% locally in your browser.

## Features

- **Single-Page Flow**: Drag-and-drop file intake (`SELECT FILES`, `CLEAR`), responsive file queue, and live preview.
- **Lossless Byte-Level Removal**: Strips EXIF, GPS, IPTC, and XMP metadata directly from container bytes (JPEG, PNG, WebP) without decoding or re-compressing image pixels.
- **Orientation & Color Preservation**: Automatically preserves JPEG `Orientation` (tag `0x0112`) and `ColorSpace` (tag `0xA001`) via direct byte APP1 reconstruction so portrait photos are never rotated on export.
- **ICC Profile Protection**: Retains ICC color profiles by default to avoid color shifts, with an explicit `Full Sanitize` option to strip ICC when desired.
- **Interactive Metadata Inspection**: View tags grouped by category with a live search filter matching tag names and values.
- **Individual & Bulk Operations**: Per-file state chips (`READING…` → `REMOVE EXIF` → `SAVE`) alongside global `Clean All` and `SAVE ALL (ZIP)`.
- **Strict File Limits**: Supports up to 20 files at once, up to 50 MB per file, with 64 MP dimension limits and 500 MB memory estimation guards.
- **Never Silently Re-Encodes**: If a format lacks a lossless carver, PixelTruth explicitly informs you rather than re-compressing pixels.
- **100% Client-Side Privacy**: All processing runs in local Web Workers. Zero file uploads, zero tracking, self-hosted fonts.
- **Offline PWA Support**: Installable Progressive Web App with offline service worker caching.

## Supported Formats

| Format | Metadata Inspection | Lossless Cleaning | Notes |
|---|---|---|---|
| **JPEG** (`.jpg`, `.jpeg`) | Yes | Yes | Lossless byte carving; preserves `Orientation` and ICC by default. |
| **PNG** (`.png`) | Yes | Yes | Lossless chunk stripping; preserves critical chunks and ICC by default. |
| **WebP** (`.webp`) | Yes | Yes | Lossless RIFF rewriting; bitstream untouched. |
| **HEIC / HEIF** (`.heic`) | Yes | Converted to JPEG | Converted to JPEG via `heic2any` in worker thread. |
| **GIF** (`.gif`) | Yes | Not supported | Header validation supported; never silently re-encoded. |
| **AVIF** (`.avif`) | Yes | Not supported | ISO-BMFF header validation supported; never silently re-encoded. |

## Privacy & Security

- **Zero-Upload Architecture**: Images never leave your device.
- **Strict CSP**: Forbids `unsafe-eval` and third-party script execution.
- **Self-Hosted Typography**: Inter and Barlow Condensed fonts are bundled locally via `@fontsource` to eliminate external font calls.
- **Zero Analytics**: No telemetry, analytics, or third-party trackers.

## Technology Stack

- **React 19** & **Vite 8**
- **Tailwind CSS 4**
- **exifr** — Fast metadata parsing
- **piexifjs** — Selective EXIF tagging
- **heic2any** — Client-side HEIC conversion
- **jszip** & **file-saver** — Client-side ZIP archiving and download triggers
- **vite-plugin-pwa** — PWA service worker and manifest management
- **Vitest** & **Playwright** — Unit invariants and E2E validation

## Development

```bash
# Install dependencies
npm install

# Start local development server
npm run dev

# Run linter
npm run lint

# Run unit and invariant tests
npm test

# Build production bundle
npm run build
```

## Documentation

- [Engineering Rules](docs/ENGINEERING_RULES.md)
- [Binary Sanitizer](docs/BINARY_SANITIZER.md)
- [Worker Architecture](docs/WORKER_ARCHITECTURE.md)
- [Performance Benchmarks](docs/PERFORMANCE.md)
- [Testing Strategy](docs/TESTING.md)
- [File & Memory Security](docs/FILE_SECURITY.md)
- [Security Model & CSP](docs/SECURITY.md)
- [Deployment Security](docs/DEPLOYMENT_SECURITY.md)
- [Privacy Policy](docs/PRIVACY.md)
- [Production Readiness](docs/PRODUCTION_READINESS.md)
- [Production Roadmap](docs/PRODUCTION_ROADMAP.md)
