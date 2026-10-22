# PixelTruth Desktop Tactical Forensic Workbench — UI Design Specification

Generated via **StitchMCP** using the **Obsidian Telemetry** design system.

- **Stitch Project ID**: `16506843630352301463`
- **Screen ID**: `9633adb659864dde9a3609c2f08597b7`
- **Design System Asset**: `assets/78b39b4eb2d146d3b76e76da657461ac`
- **Theme**: Darkroom Minimal Obsidian & Tactical Telemetry

---

## 1. Visual Hierarchy & Color Architecture

| Token | Hex | Role | Usage |
| :--- | :--- | :--- | :--- |
| **Base Substrate** | `#0B0D0F` | Void Anchor | Global workspace background, terminal recesses |
| **Surface Tier 1** | `#14171A` | Structural Panels | Left queue rail, right ledger panel, header bar |
| **Surface Tier 2** | `#1A1E23` | Active Modules | Selected payloads, telemetry card bodies |
| **Hairlines** | `#2A2F34` | Precision Separators | 1px clean partition borders |
| **Safelight Orange** | `#FF6B35` | Primary Action | Metadata purge triggers, destructive scrub actions |
| **Develop Teal-Cyan** | `#4A9B8E` | Isolation & Verify | Zero-upload air-gap enclave active badge, WASM status |
| **Warning Amber** | `#D9A441` | Threat Discovery | GPS location exposure badge, hardware serial alerts |
| **Text Primary** | `#E8ECEF` | High Contrast | Monospace tags, sensor parameters, headlines |
| **Text Muted** | `#8A95A0` | Secondary Labels | File sizes, dimensions, IFD tag IDs |

---

## 2. Workbench Layout Partitioning

### A. Top Tactical Navigation & Status Bar (Height: 56px)
- **Brand**: `PixelTruth` title with `v2.6 Core` micro-chip.
- **Air-Gap Enclave Status**: Live pulsing teal badge `ZERO-UPLOAD AIR-GAP ENCLAVE [ACTIVE]` with pinging indicator node.
- **Sandbox Telemetry Gauge**: Real-time memory allocation (`14.2 MB / 500 MB RAM`), isolated WebWorker indicator (`WASM SIMD: Isolated`), and network socket leakage check (`0 Bytes / 0 Sockets`).
- **Quick Controls**: 1-Click PWA installer, debug terminal toggle, settings drawer, and session reset.

### B. Left Drawer: Intake & Batch Staging Queue (Width: 320px)
- **High-Density Dropzone**: Hairline dashed container supporting JPEG, PNG, WebP, HEIC up to 50MB.
- **Batch Payload Queue**:
  - `canon_eos_portrait.jpg` (24.2 MP, 18.4 MB) → Amber `GPS_EXPOSED` + Error `SERIAL_FOUND` tags (Active focus).
  - `clean_screenshot.png` (4.1 MP, 1.2 MB) → Emerald `PRISTINE` check (0 metadata).
  - `drone_survey.jpg` (48.0 MP, 31.2 MB) → Amber `GPS_EXPOSED` + `FLIGHT_LOGS`.
- **Batch Purge Controls**: Safelight Orange `PURGE ALL METADATA (3 FILES)` with ambient glow + `EXPORT ZIP ARCHIVE`.

### C. Center Stage: Viewport & GPS Privacy Radar HUD (Flexible)
- **Optical Inspection Frame**:
  - Tactical HUD corner reticles (orange and teal brackets).
  - Optical telemetry readout: `4032 x 3024 px | 12.2 MP | sRGB | 24-bit TrueColor`.
  - Center crosshair alignment reticle.
- **GPS Privacy Radar Scope**:
  - Amber warning header with pulsating discovery light: `LOCATION EXPOSED`.
  - Monospace coordinate block: Latitude (`37.774929° N`), Longitude (`122.419418° W`), Altitude (`15.4m AMSL`), Geohash (`9q8yyk`), Precision (`±2.4m`).
  - Darkroom radar scope featuring concentric distance range rings (50m, 200m, 1000m), rotating radar beam animation, and coordinate lock blip.
  - Zeroing actions: `ZERO-OUT GPS COORDINATES`, `Open in OSM`, `Scramble Timestamps`, `Strip Thumbnails`.

### D. Right Drawer: Lossless Tag Ledger & Inspector (Width: 380px)
- **Lossless Tag Ledger**: Header tracking detected tags (`47 Tags Detected`).
- **Filter Bar**: Hex/ASCII instant filter (`FILTER TAGS OR HEX...`) with category pills (`All`, `Camera`, `GPS`, `Time`, `MakerNotes`).
- **High-Density Tag Rows**:
  - Hardware ID: `0xA431 SerialNumber: #9302148` (Critical leak).
  - Location: `0x0002 Coordinates: 37.774929 N, 122.419418 W` (Exact coordinates).
  - Identity: `0x0131 Software & Artist: Adobe Photoshop 2024 / "Alex V."` (Author leak).
- **Sanitization Configuration**: Toggle switches for `Strip ICC Color Profile` and `Lossless Huffman Stream Preservation`.
- **Footer Actions**: `SCRUB SELECTED TAGS` and `DOWNLOAD LOSSLESS PHOTO`.
