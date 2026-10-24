# PixelTruth

A browser-native image metadata and EXIF remover. Inspect metadata, strip sensitive tags losslessly at the byte level, and download cleaned files individually or as a ZIP archive — 100% locally in your browser.

## Features

- **Single-Page Flow**: Drag-and-drop file intake (`SELECT FILES`, `CLEAR`), responsive file queue, and live preview.
- **Lossless Byte-Level Removal**: Strips EXIF, GPS, IPTC, XMP, and C2PA metadata directly from container bytes (JPEG, PNG, WebP, GIF, AVIF) without decoding or re-compressing image pixels.
- **Independent Post-Clean Verification**: Every cleaned binary is verified via format-specific structural checks and independent parser cross-checks, reporting truthful verification statuses (`VERIFICATION_PASSED`, `METADATA_REMAINS`, `VERIFICATION_FAILED`).
- **Orientation & Color Preservation**: Automatically preserves JPEG `Orientation` (tag `0x0112`) and `ColorSpace` (tag `0xA001`) via direct byte APP1 reconstruction so portrait photos are never rotated on export.
- **ICC Profile Protection**: Retains ICC color profiles by default to avoid color shifts, with an explicit `Full Sanitize` option to strip ICC when desired.
- **Interactive Metadata Inspection**: View tags grouped by category with a live search filter matching tag names and values.
- **Individual & Bulk Operations**: Per-file state chips (`READING…` → `REMOVE EXIF` → `SAVE`) alongside global `Clean All` and `SAVE ALL (ZIP)`.
- **Strict File Limits**: Supports up to 20 files at once, up to 50 MB per file, with 64 MP dimension limits and 500 MB memory estimation guards.
- **Never Silently Re-Encodes**: Lossless formats remain strictly byte-identical at the pixel level. Lossy transformations (such as HEIC conversion) are explicitly disclosed.
- **100% Client-Side Privacy**: All processing runs in local Web Workers. Zero file uploads, zero tracking, self-hosted fonts.
- **Offline PWA Support**: Installable Progressive Web App with offline service worker caching.

## Supported Formats

| Format | Metadata Inspection | Cleaning Method | Lossless Guarantee | Notes |
|---|---|---|---|---|
| **JPEG** (`.jpg`, `.jpeg`) | Yes | Direct byte carving | Lossless | Strips EXIF, GPS, XMP, IPTC, COM, C2PA; preserves Orientation and ICC by default. |
| **PNG** (`.png`) | Yes | Chunk carving | Lossless | Strips `eXIf`, `tIME`, `tEXt`, `zTXt`, `iTXt`, `caBX`; preserves `IHDR`/`IDAT`/`IEND` and `iCCP`. |
| **WebP** (`.webp`) | Yes | RIFF chunk carving | Lossless | Strips `EXIF`, `XMP `, `C2PA`; bitstream (`VP8 `/`VP8L`/`ANIM`) untouched. |
| **GIF** (`.gif`) | Yes | Block carving | Lossless | Strips Comment Extensions and trailing payloads; preserves graphics/animation. |
| **AVIF** (`.avif`) | Yes | ISOBMFF box carving | Lossless | Strips `meta` metadata and unneeded auxiliary boxes while keeping image bitstream. |
| **HEIC / HEIF** (`.heic`) | Yes | Decode & convert | Lossy (Disclosed) | Decoded in Web Worker and exported as clean JPEG; previews downscaled to max 384px to prevent memory spikes. |
| **MP4 / MOV** (`.mp4`, `.mov`) | Yes | Atom carving | Lossless *(Experimental)* | In-place zeroing of `udta` (user data/GPS) into `free` atoms to preserve sample table offsets. Marked experimental. |
| **PDF** (`.pdf`) | Yes | Stream neutralization | Lossless *(Experimental)* | Neutralizes XML metadata streams and `/Info` dictionaries. Marked experimental. |

## Post-Clean Verification Integrity

PixelTruth implements a format-specific post-clean verification engine ([`postCleanVerifier.js`](file:///c:/Users/Atharva/Desktop/PixelTruth/src/services/verification/postCleanVerifier.js)) to guarantee output integrity:
1. **Container Structural Verification**: Confirms valid magic headers, bounding chunks/atoms, EOF markers (`EOI`, `IEND`, Trailer), and checks for unexpected trailing payloads.
2. **Metadata Remnant Binary Scanning**: Scans for unremoved metadata segments (APP1 EXIF/XMP, APP11 C2PA, APP13 IPTC, COM, PNG `eXIf`/`tIME`/`caBX`, WebP `EXIF`/`XMP `/`C2PA`, MP4 `udta`).
3. **External Parser Cross-Check**: Validates with independent parser `exifr` to ensure zero disallowed tags (GPS coordinates, camera serials, timestamps) leaked into the output.
4. **Truthful Status Reporting**:
   - `VERIFICATION_PASSED`: All structural integrity checks passed and verified clean across all specified categories.
   - `METADATA_REMAINS`: File structure is valid, but unstripped or disallowed metadata remnants were detected.
   - `VERIFICATION_FAILED`: File container is malformed, truncated, or unparseable.

PixelTruth never claims universal zero metadata leakage without supporting verification checks.

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
