# PixelTruth Performance Optimization

## Architecture & Memory Profile

### Zero-Copy Worker Memory
During queue ingestion, `File` objects are passed directly to worker tasks or sliced on demand. Workers consume `ArrayBuffer` payloads using transferable objects (`transfer: [buffer]`), avoiding duplicate allocations on the main thread and keeping the UI thread fluid.

### Single Pool Resource Footprint
With the removal of redundant worker pools (`c2paPool`, `inspectorPool`, `forensicsPool`), background memory and context-switching overhead are significantly reduced. All tasks run through a single `imagePool` bounded by `navigator.hardwareConcurrency` (max 4 concurrent threads).

---

## Production Build Metrics (Measured)

Following the removal of C2PA, Inspect, and Workspace modules:

| Asset | Baseline (HEAD `da1c6b3`) | Current Measured Build | Delta |
|---|---|---|---|
| App Shell (`index-*.js`) | 433.24 kB raw / **129.75 kB gzip** | 388.93 kB raw / **119.20 kB gzip** | -10.55 kB gzip (-8.1%) |
| Stylesheet (`index-*.css`) | 55.64 kB raw / 9.76 kB gzip | 48.79 kB raw / 8.69 kB gzip | -1.07 kB gzip |
| Worker (`image.worker-*.js`) | 1,467.86 kB raw | 1,470.24 kB raw | +2.38 kB raw |
| C2PA Worker | 71.49 kB raw | **0 kB (Deleted)** | -71.49 kB |
| C2PA WASM (`c2pa_bg-*.wasm`)| 8,434.89 kB raw / 3,247.22 kB gzip | **0 kB (Deleted)** | -8.43 MB raw |
| Total `dist/` Directory Size | **12.0 MB** | **~3.17 MB** | **-8.83 MB (-73.6%)** |
| PWA Precache | 19 entries / 2,003.81 KiB | 16 entries / 1,905.11 KiB | -3 entries / -98.7 KiB |

---

## Performance Budgets

1. **Initial Page Load JS (App Shell)**:
   - **Budget**: $\le 135\text{ kB}$ gzip.
   - **Measured**: **119.20 kB gzip** (PASS).
2. **Binary WASM Footprint**:
   - **Budget**: 0 kB.
   - **Measured**: 0 kB (PASS — all `.wasm` files eliminated).
3. **Total Dist Footprint**:
   - **Budget**: $\le 4\text{ MB}$.
   - **Measured**: **~3.17 MB** (PASS).
