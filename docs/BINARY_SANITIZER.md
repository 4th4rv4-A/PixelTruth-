# Lossless Binary Sanitization Engine

PixelTruth implements a custom, format-aware binary sanitization engine in `src/services/binary/`. 

This engine is used during the metadata cleaning process to remove privacy-compromising metadata without re-encoding or re-compressing the actual image pixel payload. This ensures perfect preservation of image quality (lossless) and significantly improves performance by avoiding HTML Canvas operations on the main thread.

## Supported Formats

- **JPEG**: Lossless removal of APP0-APP15 (including EXIF, XMP, IPTC, JUMBF/C2PA) and COM segments. The payload after `SOS` (Start of Scan) is preserved exactly.
- **PNG**: Lossless removal of ancillary text and metadata chunks (`eXIf`, `tEXt`, `zTXt`, `iTXt`, `caBX`, `iCCP`). Critical chunks (`IHDR`, `PLTE`, `IDAT`, `IEND`) are never modified.
- **WebP**: Lossless removal of metadata chunks (`EXIF`, `XMP `, `ICCP`) from the RIFF container. The `VP8X` flags and RIFF header size are safely rewritten, but the `VP8`/`VP8L` compressed bitstream is untouched.

## Unsupported Formats & Fallback

- **HEIC / HEIF**: ISO Base Media File Format box parsing is highly complex and currently unsupported for safe binary editing in this engine. HEIC files automatically fall back to the legacy canvas pipeline, where they are converted to JPEG (`heic2any`) and fully re-encoded.

### The Fallback Mechanism

If the binary sanitization engine encounters a file it cannot safely process, it returns a `fallback-required`, `malformed`, or `unsafe` status. The `stripMetadata.js` orchestration layer will log a warning and seamlessly fall back to drawing the image to an HTML Canvas to completely scrub it via re-encoding.

## Limitations

- **Selective Stripping**: The binary engine removes entire metadata segments (e.g. the entire `APP1` EXIF block). If a user requests a *selective* strip (where specific EXIF tags are preserved but others are removed), PixelTruth falls back to using `piexifjs` to parse and rewrite the EXIF directory natively. (This fallback still preserves the image pixel payload for JPEG, as `piexifjs` operates on DataURLs).
- **Corrupt Files**: Files with mismatched internal bounds, truncated chunk headers, or signatures matching multiple definitions will be aggressively rejected as `malformed` to prevent DOS attacks or memory leaks in the parser.
