# Security Posture

PixelTruth is built with a defense-in-depth security architecture designed primarily to protect users from malicious payloads during local forensic analysis and to ensure complete operational privacy.

## Architectural Security Rules

1. **Zero External Inference**: PixelTruth does not rely on third-party cloud APIs for AI detection or metadata extraction.
2. **Strict Content Security Policy (CSP)**: We enforce a CSP that entirely disables `unsafe-eval` for standard scripts and restricts it only to WebAssembly execution (`wasm-unsafe-eval`) required by ONNX runtime. We self-host all fonts to ensure zero third-party network requests during normal operation.
3. **No Unbounded Memory Allocation**: The `ReportGenerator` explicitly limits string and object depths to prevent malicious payloads (such as zip-bombed XMP chunks) from exhausting browser memory or causing infinite loops during JSON serialization.
4. **Sandboxed Processing**: Heavy parsing, cryptography (SHA-256), and image decoding occur inside isolated Web Workers to prevent main-thread locking.
5. **Debug Guards**: In production builds, all developer console logging and global state exposures are stripped.

## Reporting Vulnerabilities
If you discover a security vulnerability in PixelTruth, please report it privately to the maintainers rather than opening a public issue.
