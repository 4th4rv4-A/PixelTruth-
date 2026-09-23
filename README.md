# PixelTruth

A browser-native image metadata and provenance utility. Inspect, selectively remove, and bulk-download image metadata entirely locally in your browser.

## Features

### Clean Workflow
- **Full metadata strip** — re-encode the image through an HTML canvas, removing all EXIF, GPS, IPTC, XMP, and other embedded metadata.
- **Selective metadata strip** (JPEG only) — choose which metadata tags to keep and which to remove, using piexifjs for precision EXIF editing.
- **Bulk processing** — process up to 20 images at once and download them as a ZIP archive.
- **Size comparison** — see the original and cleaned file sizes after processing.

### Detect Workflow
- **C2PA Content Credentials** — inspect images for embedded C2PA provenance manifests using the `@contentauth/c2pa-web` library.
- **AI generation markers** — detect known AI-generation software identifiers in EXIF software tags (Midjourney, DALL-E, Stable Diffusion, etc.).
- **Validation-aware** — distinguishes between structurally valid credentials, trusted credentials, and untrusted credentials.

### Supported Formats
- **JPEG** (`.jpg`, `.jpeg`) — full and selective metadata cleaning
- **PNG** (`.png`) — full strip only
- **WebP** (`.webp`) — full strip, format preserved
- **HEIC/HEIF** (`.heic`, `.heif`) — converted to JPEG at cleaning time (lossy transcode); originals are preserved for detection

### Privacy
- **Image files are processed entirely in your browser.** No image data is uploaded to any server.
- **External resources:** Google Fonts are loaded from Google's CDN for typography.
- **No analytics or tracking.** No external APIs are used for image processing.

## Important Limitations

- **No Visual AI Detection.** PixelTruth relies entirely on metadata heuristics and C2PA credentials. It cannot identify AI-generated images that lack metadata markers.
- **HEIC/HEIF Lossy Transcoding.** Cleaning HEIC files requires re-encoding to JPEG, which will slightly alter image quality and file size. The output is not bit-for-bit identical to the input.
- **Full Strip Re-encoding.** A "full strip" on any format re-encodes the image via HTML Canvas, potentially introducing minor compression artifacts.
- **C2PA Trust Anchors.** Trust anchors and validation behavior depend entirely on the installed `@contentauth/c2pa-web` SDK. PixelTruth currently evaluates structural cryptographic validity but may lack global trust root provisioning.
- **Metadata Spoofing.** Software tags are easily spoofed or stripped. Metadata heuristics are not a definitive proof of authenticity.

## Technology Stack

- React 19
- Vite 8
- Tailwind CSS 4
- `@contentauth/c2pa-web` — C2PA Content Credential reading
- `exifr` — EXIF/XMP/IPTC metadata parsing
- `piexifjs` — EXIF editing for selective strip
- `heic2any` — HEIC/HEIF to JPEG conversion
- `JSZip` + `file-saver` — ZIP generation and download

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
```

## Testing

Tests use Vitest and focus on regression coverage for:
- Privacy classification (GPS, device info, no metadata)
- Verdict state machine (C2PA validation states → verdict mapping)
- Filename deduplication and path traversal sanitization for ZIP archives
- Dimension safety (oversized, missing dimensions, parse failures)

```bash
npm test
```
