# PixelTruth Forensic Report Generator

PixelTruth includes a deterministic, zero-dependency Forensic Report Generator. It aggregates all structural, metadata, provenance, and diagnostic signal intelligence into a unified, machine-readable JSON payload and a human-readable HTML document.

## Core Privacy Guarantee
**The forensic report is generated entirely locally within your browser.** 
- The image bytes never leave your device.
- The report is never uploaded or logged to a remote server.
- PixelTruth does not track case numbers or execution telemetry.

## Output Formats

### 1. JSON (Machine-Readable)
The core output is a canonical JSON file detailing the physical structure and evaluation of the file. 
*Note: Unless you specifically implement a cryptographic signing layer downstream, this JSON file is plain text and is not cryptographically signed. Do not claim it is tamper-proof.*

### 2. HTML / PDF (Human-Readable)
The HTML export converts the JSON payload into a clean, professional document.
PixelTruth leverages your browser's native `window.print()` capability via dedicated `@media print` CSS rules. This allows you to "Save as PDF" instantly, producing a perfectly formatted document without the massive performance overhead and layout bugs associated with bloated client-side PDF generation libraries (like `jspdf`).

## Handling Malicious Data
Forensic analysis frequently encounters malicious or corrupted files. The `ReportGenerator` explicitly protects against memory exhaustion (e.g., zip-bombed XMP metadata) by enforcing strict string-length bounding (`boundValue`) and depth-limiting on all extracted metadata structures before they are embedded into the JSON payload.

## Limitations Disclosure
The report generation engine explicitly groups ELA, FFT, and local AI scores under a `forensicSignals` namespace, and explicitly documents their limitations at the bottom of every generated report. The report generator refuses to collapse diagnostic heuristics into absolute claims of origin.
