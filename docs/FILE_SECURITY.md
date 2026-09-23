# File Intake Security Policy

PixelTruth enforces a strict, layered binary validation pipeline for all incoming files. Because browsers can be vulnerable to decompression bombs (images with small file sizes but enormous pixel dimensions that crash the tab by exhausting memory), we never rely on file extensions, MIME types, or purely size-based heuristics to establish safety.

## 1. Magic Number Validation
The first 16 bytes of any file are parsed to confirm the actual binary structure.
We strictly accept:
- **JPEG**: `FF D8 FF`
- **PNG**: `89 50 4E 47`
- **WebP**: `RIFF` ... `WEBP`
- **HEIF/HEIC**: `ftyp` box signatures

Files failing this check are rejected with `INVALID_SIGNATURE`.

## 2. Header-Level Dimension Parsing
Before an image is passed to `createImageBitmap` or drawn to an HTML Canvas, PixelTruth parses the image container to extract its width and height:
- **JPEG**: Scans for `SOFn` (Start of Frame) markers.
- **PNG**: Parses the `IHDR` chunk.
- **WebP**: Parses `VP8X`, `VP8 `, or `VP8L` chunks.
- **HEIC**: Recursively scans ISO Base Media File Format boxes (up to 1MB deep) for the `ispe` (Image Spatial Extent) box.

If dimensions cannot be found, the file is rejected with `DIMENSIONS_UNKNOWN`. **The legacy 15MB size-fallback has been completely removed.**

## 3. Limit Enforcement
- **Maximum File Size**: 50 MB (`FILE_TOO_LARGE`)
- **Maximum Pixel Count**: 64,000,000 pixels (64MP) (`PIXEL_LIMIT_EXCEEDED`)
- **Estimated Memory Limit**: 500 MB (`ESTIMATED_MEMORY_EXCEEDED`)
  - *Formula*: `width * height * 4 (bytes per pixel) * 1.5 (browser overhead factor)`
- **Maximum Metadata Block Size**: 20 MB (`METADATA_TOO_LARGE`)
  - We accumulate the sizes of EXIF, XMP, IPTC, and textual chunks during the header scan. If a malicious file attempts to exhaust memory via massive text chunks before the image payload, it is rejected.

## 4. Integration Point
The validation pipeline (`validateFile`) is integrated directly into the `Dropzone` components. If a file fails validation, it is immediately rejected and the user is shown a specific error reason. 
