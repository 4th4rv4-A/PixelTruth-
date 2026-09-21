# PixelTruth

A privacy-focused, client-side image metadata and provenance utility. Inspect, selectively remove, and bulk-download image metadata — all processed locally in your browser.

## Features

### Clean Workflow
- **Full metadata strip** — re-encode the image through an HTML canvas, removing all EXIF, GPS, IPTC, XMP, and other embedded metadata.
- **Selective metadata strip** (JPEG only) — choose which metadata tags to keep and which to remove, using piexifjs for precision EXIF editing.
- **Bulk processing** — clean up to 20 images at once and download them as a ZIP archive.
- **Size comparison** — see the original and cleaned file sizes after processing.

### Detect Workflow
- **C2PA Content Credentials** — inspect images for embedded C2PA provenance manifests using the [@contentauth/c2pa-web](https://www.npmjs.com/package/@contentauth/c2pa-web) library.
- **AI generation markers** — detect known AI-generation software identifiers in EXIF software tags (Midjourney, DALL-E, Stable Diffusion, etc.).
- **Validation-aware** — verdicts are gated on the C2PA library's validation state. Only "Valid" or "Trusted" validation states produce verified claims.

### Supported Formats
- **JPEG** (`.jpg`, `.jpeg`) — full and selective metadata cleaning
- **PNG** (`.png`) — full strip only
- **WebP** (`.webp`) — full strip, format preserved
- **HEIC/HEIF** (`.heic`, `.heif`) — converted to JPEG at cleaning time; originals are preserved for detection

### Privacy
- **Image files are processed entirely in your browser.** No image data is uploaded to any server by PixelTruth's image-processing workflow.
- **External resources:** Google Fonts are loaded from Google's CDN for typography. This is the only external network request made by the application.
- **No analytics or tracking.** No external AI detection APIs are used.

## C2PA / Provenance

PixelTruth uses the C2PA (Coalition for Content Provenance and Authenticity) standard to inspect Content Credentials embedded in images. This is a **metadata-based** inspection — it does not perform visual/pixel-level AI detection.

### Important Limitations
- **Metadata heuristics are not a definitive AI classifier.** Software tags can be edited or spoofed.
- **C2PA provenance does not automatically prove the complete origin of an image.** It establishes a chain of custody as recorded by participating software.
- **No AI marker ≠ proof of non-AI generation.** Many AI-generated images have no C2PA credentials or software tags.
- **Validation depends on the C2PA library.** The validation state reflects what the installed `@contentauth/c2pa-web` SDK can determine. Trust configuration may affect results.

## HEIC/HEIF Handling

HEIC/HEIF files are handled with a split architecture:

- **Detection** inspects the **original** HEIC file to preserve all metadata and provenance information.
- **Cleaning** converts HEIC to JPEG **at cleaning time** (not during upload), then strips metadata from the resulting JPEG.
- Output files from HEIC inputs will have a `.jpg` extension and `image/jpeg` MIME type.
- Full cleaning **re-encodes** the image, which may cause minor quality changes.

## Technology Stack

- [React](https://react.dev/) 19
- [Vite](https://vitejs.dev/) 8
- [Tailwind CSS](https://tailwindcss.com/) 4
- [@contentauth/c2pa-web](https://www.npmjs.com/package/@contentauth/c2pa-web) — C2PA Content Credential reading
- [exifr](https://www.npmjs.com/package/exifr) — EXIF/XMP/IPTC metadata parsing
- [piexifjs](https://www.npmjs.com/package/piexifjs) — EXIF editing for selective strip
- [heic2any](https://www.npmjs.com/package/heic2any) — HEIC/HEIF to JPEG conversion
- [JSZip](https://www.npmjs.com/package/jszip) + [file-saver](https://www.npmjs.com/package/file-saver) — ZIP generation and download
- [react-hot-toast](https://react-hot-toast.com/) — Toast notifications
- [vite-plugin-pwa](https://vite-pwa-org.netlify.app/) — Progressive Web App support

## Project Structure

```
src/
├── App.jsx                     # Main application component
├── main.jsx                    # Entry point
├── index.css                   # Tailwind theme and custom styles
├── components/
│   ├── Header.jsx              # Navigation with tab switching and dark mode
│   ├── Dropzone.jsx            # File upload for Clean tab
│   ├── DetectDropzone.jsx      # File upload for Detect tab
│   ├── FileQueue.jsx           # File list with metadata inspection
│   ├── MetadataTable.jsx       # Metadata display with selective keep/remove
│   ├── PrivacyBadge.jsx        # Privacy risk indicator
│   ├── CleanButton.jsx         # Clean + download with size report
│   ├── VerdictCard.jsx         # AI detection result display
│   ├── CredentialDetails.jsx   # Expandable C2PA credential details
│   ├── InstallPrompt.jsx       # PWA install prompt
│   └── ErrorBoundary.jsx       # Error boundary for graceful recovery
└── utils/
    ├── detectAI.js             # C2PA and software tag detection
    ├── readMetadata.js         # EXIF/metadata parsing and privacy classification
    ├── stripMetadata.js        # Full and selective metadata stripping
    ├── normalizeInput.js       # File validation, dimension safety, thumbnails
    ├── zipDownload.js          # ZIP bundling with filename deduplication
    ├── filenameUtils.js        # Output MIME/extension mapping and resolution
    ├── sizeUtils.js            # Size formatting and delta calculation
    └── verdicts.js             # Centralized verdict constants
```

## Development

```bash
# Install dependencies
npm install

# Start dev server
npm run dev

# Lint
npm run lint

# Run tests
npm test

# Build for production
npm run build

# Preview production build
npm run preview
```

## Testing

Tests use [Vitest](https://vitest.dev/) and focus on regression coverage for:

- Privacy classification (GPS, GPS at 0,0, device info, no metadata)
- Verdict state machine (C2PA validation states → verdict mapping)
- Filename deduplication for ZIP archives
- Dimension safety (oversized, missing dimensions, parse failures)
- Size comparison formatting
- HEIC conversion path correctness

```bash
npm test
```

## PWA

PixelTruth is installable as a Progressive Web App. The service worker precaches the app shell but intentionally excludes the C2PA/WASM chunks (which are lazy-loaded only when the Detect tab is used).

## Known Limitations

- **No visual AI detection.** Detection is metadata-based only. It cannot identify AI-generated images that lack metadata markers.
- **HEIC/HEIF conversion uses lossy JPEG.** Cleaning HEIC files involves re-encoding to JPEG, which may slightly alter image quality.
- **Full strip re-encodes the image.** This can change file size and introduce minor compression artifacts.
- **Selective strip is JPEG-only.** PNG, WebP, and HEIC files always receive a full strip.
- **C2PA validation depends on the SDK.** Trust anchors and validation behavior are determined by the installed `@contentauth/c2pa-web` version.
- **Browser HEIC support varies.** HEIC thumbnails are generated via `heic2any`; native browser HEIC decoding is not required.
- **CSP meta tag is included for static hosting.** For production deployments behind a reverse proxy, prefer setting CSP via HTTP response headers for better security control.
