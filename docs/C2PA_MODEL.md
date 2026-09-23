# PixelTruth C2PA Model

PixelTruth strictly separates **Cryptographic Provenance** (what we can cryptographically prove using signatures) from **Forensic Inference** (what we can guess based on metadata strings or heuristic markers).

## Provenance States

1. **`NO_PROVENANCE`**: No C2PA manifest is present in the file container.
2. **`PROVENANCE_PRESENT_UNVALIDATED`**: A C2PA manifest exists, but it failed structural/signature validation, or validation couldn't be completed. This indicates tampering or missing certificate chains.
3. **`PROVENANCE_VALID`**: The manifest is structurally sound and the cryptographic signature is mathematically valid. The signer is verified, but the signing certificate may not be in the global trust list (e.g. a self-signed cert).
4. **`PROVENANCE_TRUSTED`**: The manifest is valid, and the signer is cryptographically trusted via a known authority (e.g. Adobe, Microsoft, Truepic).
5. **`SIGNED_AI_PROVENANCE`**: The manifest is valid/trusted, AND the signed assertions *explicitly claim* the media is AI-generated (e.g., via `c2pa.actions` or `c2pa.created` digital source types).

## AI Inference States

These states do NOT rely on cryptography. They rely on plaintext, unauthenticated metadata that can be easily spoofed or removed.

1. **`NO_AI_SIGNAL`**: No forensic evidence of AI generation.
2. **`AI_SOFTWARE_SIGNAL`**: Plaintext metadata (e.g., Software or Generator strings like "Midjourney", "DALL-E") implies AI generation.
3. **`AI_METADATA_SIGNAL`**: Specific EXIF or XMP tags indicating AI origin, without being part of a signed C2PA manifest.
4. **`MODEL_SIGNAL`**: Deep learning model classification (future).

## What PixelTruth Can Prove
- PixelTruth CAN prove that a file was signed by a specific software at a specific time (if Trusted/Valid).
- PixelTruth CAN prove if a signed file explicitly claims to be AI-generated (if the generator injected an AI action into the C2PA manifest).

## What PixelTruth Cannot Prove
- PixelTruth CANNOT prove an image is "Real" just because it has a valid C2PA manifest from a camera.
- PixelTruth CANNOT prove an image is "Verified AI" just because its plaintext generator string says "Adobe Firefly". Only cryptographic signatures provide verification; plaintext strings only provide inference (`POSSIBLE` AI).
