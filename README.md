# PixelTruth
A browser-native image metadata and provenance utility. Inspect, selectively remove, and bulk-download image metadata entirely locally in your browser.

## Features

### Clean Workflow
- **Full Strip (Lossless)**: Removes EXIF, GPS, IPTC, and XMP metadata losslessly by stripping segments at the byte level. Canvas re-encoding is only used as a fallback if the lossless path fails.
- **Privacy Clean vs Full Sanitize**: Choose "Privacy Clean" to preserve C2PA manifests and ICC color profiles, or "Full Sanitize" to strip absolutely everything.
- **Selective Strip (JPEG only)**: Choose specific EXIF metadata tags to keep via piexifjs without full re-encoding.
- **Bulk Processing**: Process up to 20 images at once and download them as a ZIP archive.
- **Size Comparison**: See the original and cleaned file sizes after processing.

### Detect Workflow
- **C2PA Content Credentials**: Inspect images for embedded cryptographic provenance using the `@contentauth/c2pa-web` SDK, including AI-related assertions and the generator name inside the credential. An image with no credential gets "no significant signal", which does not prove it is authentic.

### Inspect & Workspace
- **Forensic Inspector**: Deep dive into the file's binary structure, hex data, metadata ledger, and run ELA (Error Level Analysis) and FFT (Fast Fourier Transform) visual forensic heuristics.
- **Workspace**: Save forensic reports to your browser's local IndexedDB. Export reports as JSON or HTML (Print/PDF).
- **Progressive Web App (PWA)**: Includes a service worker and manifest, allowing installation as an offline desktop or mobile app.

## Supported Formats

| Format | Clean | Detect & Inspect | Notes |
|---|---|---|---|
| JPEG (`.jpg`, `.jpeg`) | Full & Selective | Yes | Full strip uses lossless byte removal |
| PNG (`.png`) | Full Strip only | Yes | Full strip uses lossless byte removal |
| WebP (`.webp`) | Full Strip only | Yes | Full strip uses lossless byte removal |
| HEIC/HEIF (`.heic`) | Converted to JPEG | Yes | Original preserved for detection. Canvas fallback required |

## Privacy
- **100% Client-Side**: All inspection, C2PA extraction, and metadata stripping runs locally in your browser. No image data is ever uploaded to a server.
- **Self-Hosted Fonts**: Fonts are loaded locally via `@fontsource` to prevent third-party network requests.
- **No Analytics**: No external APIs or trackers are used.

## Limitations
- **Metadata Spoofing**: Software tags are easily spoofed or stripped. Metadata heuristics are not definitive proof of authenticity.
- **Heuristics, Not Proof**: ELA and FFT are visual forensic heuristics that highlight structural anomalies, not definitive proof of AI generation or tampering.
- **C2PA Trust Anchors**: Trust anchors are not provisioned. While cryptographic signatures are structurally validated, valid credentials may show as "untrusted" if the root certificate isn't known to the SDK.
- **Fallback Re-encoding**: The lossless path is used first; canvas re-encoding happens only as a fallback and may add minor compression artifacts.
- **HEIC Transcoding**: Cleaning HEIC files requires transcoding to JPEG, which will slightly alter image quality and file size. The output is not bit-for-bit identical to the input.

## Technology Stack
- React 19
- Vite 8
- Tailwind CSS 4
- `@contentauth/c2pa-web` — C2PA Content Credential reading
- `exifr` — EXIF/XMP/IPTC metadata parsing
- `piexifjs` — EXIF editing for selective strip
- `heic2any` — HEIC/HEIF to JPEG conversion
- `jszip` & `file-saver` — ZIP generation and download
- `@fontsource/inter` & `@fontsource/barlow-condensed` — Self-hosted typography
- `vite-plugin-pwa` — PWA support

## Development

```bash
# Install dependencies
npm install

# Start dev server
npm run dev

# Lint
npm run lint

# Build for production
npm run build

# Run unit tests
npm test

# Run E2E tests
npx playwright install chromium
npm run test:e2e
```

## Documentation
- [Security Model & CSP](docs/SECURITY.md)
- [Deployment Security](docs/DEPLOYMENT_SECURITY.md)
- [Privacy Policy Details](docs/PRIVACY.md)
- [File & Memory Security](docs/FILE_SECURITY.md)
- [Worker Architecture](docs/WORKER_ARCHITECTURE.md)
- [Binary Sanitizer](docs/BINARY_SANITIZER.md)
- [C2PA Implementation](docs/C2PA_MODEL.md)
- [Forensic Signals](docs/FORENSIC_SIGNALS.md)
- [Verdict State Machine](docs/VERDICT_MODEL.md)
- [Forensic Report Schema](docs/FORENSIC_REPORT.md)
- [Local Workspace & Storage](docs/LOCAL_WORKSPACE.md)
- [Performance Benchmarks](docs/PERFORMANCE.md)
- [Testing Strategy](docs/TESTING.md)
- [Engineering Rules](docs/ENGINEERING_RULES.md)
- [Production Readiness](docs/PRODUCTION_READINESS.md)
- [Production Roadmap](docs/PRODUCTION_ROADMAP.md)
