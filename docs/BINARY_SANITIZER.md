# Lossless Binary Sanitization Engine

PixelTruth implements a custom, format-aware binary sanitization engine in `src/services/binary/`.

This engine strips privacy-compromising metadata directly at the byte level without re-encoding or re-compressing the actual image pixel payload. This ensures lossless preservation of image quality and avoids HTML Canvas operations.

## Supported Formats

- **JPEG**: Lossless removal of APP0–APP15 (including EXIF, XMP, IPTC) and COM segments. The pixel payload from `SOS` (Start of Scan) through `EOI` (End of Image) is preserved byte-for-byte.
  - **Orientation & ColorSpace Preservation**: By default, `extractExifPreserveTags` inspects the input bytes for `Orientation` (IFD0 tag `0x0112`) and `ColorSpace` (Exif IFD tag `0xA001`). If either exists, `buildMinimalExifApp1` uses direct byte construction (no base64 or external library overhead) to synthesize and splice a minimal APP1 segment ahead of `SOS`. If no orientation tag was present, no empty APP1 segment is injected.
  - **ICC Profile Preservation**: ICC color profiles (in `APP2` segments) are preserved by default (`removeIcc: false`), ensuring colors do not shift. Stripping ICC profiles is available via the explicit `Full Sanitize` toggle (`removeIcc: true`).
- **PNG**: Lossless removal of ancillary text and metadata chunks (`eXIf`, `tEXt`, `zTXt`, `iTXt`, `iCCP`). Critical chunks (`IHDR`, `PLTE`, `IDAT`, `IEND`) are never modified. ICC profile chunk (`iCCP`) is preserved by default unless `Full Sanitize` is enabled.
- **WebP**: Lossless removal of metadata chunks (`EXIF`, `XMP `, `ICCP`) from the RIFF container. The `VP8X` flags and RIFF header size are safely rewritten, but the compressed bitstream (`VP8`/`VP8L`) is untouched.

## Format Intake Without Lossless Carver

- **GIF & AVIF**: Intake validation parses header-level dimensions (GIF: logical screen descriptor bytes 6–9; AVIF: ISO-BMFF `ispe` box inside `meta`). Because lossless binary carvers are not implemented for GIF/AVIF containers, PixelTruth strictly surfaces `"Metadata removal not supported for this format (lossless carver unavailable)"` rather than re-encoding pixels. PixelTruth strictly forbids silent pixel re-encoding.
- **HEIC / HEIF**: High-efficiency containers are decoded and converted to JPEG in the background worker via `heic2any` for client-side processing.

## Deterministic Invariants

The sanitization engine is verified by vitest invariant assertions (`src/services/binary/__tests__/binarySanitizer.test.js`):
1. Stripping a JPEG with `Orientation = 6` retains an `APP1` containing `0x0112 = 6`.
2. Stripping a JPEG with GPS, Make, Model, and Orientation removes all sensitive tags while preserving `Orientation` and ensuring the `SOS` -> `EOI` slice remains strictly identical (`deepEqual`).
3. Default policy retains ICC profile (`APP2`); `Full Sanitize` removes it.
4. Input JPEGs without orientation data receive no synthesized `APP1` segment.
