# Deployment Security & Load Balancer Ingress Configuration

When deploying PixelTruth to a production environment (such as Vercel, Cloudflare Pages, AWS CloudFront + ALB, or enterprise NGINX / Kubernetes Ingress), specific HTTP security headers and multi-tier edge caching policies are required to maintain the application's strict privacy and security posture.

---

## 1. Required Ingress Headers

PixelTruth includes a hardened [vercel.json](file:///c:/Users/Atharva/Desktop/PixelTruth/vercel.json) file at the repository root and a reference [nginx/nginx.conf](file:///c:/Users/Atharva/Desktop/PixelTruth/nginx/nginx.conf). If deploying behind an enterprise Load Balancer (AWS ALB, F5 BIG-IP, Cloudflare, Citrix ADC), configure your edge to inject the following headers:

### Content Security Policy (CSP)
```http
Content-Security-Policy: default-src 'self'; script-src 'self' 'wasm-unsafe-eval' blob:; style-src 'self' 'unsafe-inline'; font-src 'self'; img-src 'self' blob: data:; connect-src 'self' blob: data:; worker-src 'self' blob:; child-src 'self' blob:; frame-src 'self' https://www.openstreetmap.org; object-src 'none'; base-uri 'self'; form-action 'none'; frame-ancestors 'none';
```
* **WASM Runtime**: `'wasm-unsafe-eval'` is permitted strictly for local WebAssembly decoding engines.
* **Map Previews**: `frame-src 'self' https://www.openstreetmap.org` allows the GPS Privacy Radar to render on-demand location context without compromising client-side image isolation.
* **Anti-Framing**: `frame-ancestors 'none'` prevents framing by any external origin.

### Anti-Clickjacking (Legacy & Defense-in-Depth)
```http
X-Frame-Options: DENY
```
*Enforces top-level clickjacking protection on legacy reverse proxies and older browsers that do not parse CSP `frame-ancestors`.*

### Process Isolation (COOP)
```http
Cross-Origin-Opener-Policy: same-origin
```
*Isolates PixelTruth into its own dedicated browsing context group, mitigating speculative execution and cross-origin side-channel attacks against large in-memory image buffers.*

### Strict-Transport-Security (HSTS)
```http
Strict-Transport-Security: max-age=31536000; includeSubDomains; preload
```
*Enforces HTTPS connections and enables HSTS preload eligibility.*

### MIME-Sniffing Protection
```http
X-Content-Type-Options: nosniff
```
*Prevents browsers from MIME-sniffing away from declared content types.*

### Referrer Policy
```http
Referrer-Policy: strict-origin-when-cross-origin
```
*Limits referrer leakage when navigating out to map providers.*

### Permissions Policy
```http
Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=()
```
*Explicitly disables all hardware device sensors and payment APIs.*

---

## 2. Multi-Tier Edge Caching Architecture

To prevent PWA service worker locking, stale worker execution, and Blue/Green rolling deployment asset `404 ChunkLoadErrors`, enterprise reverse proxies and load balancers MUST enforce three distinct caching tiers:

| Tier | Resources | Header Directive | Rationale |
| :--- | :--- | :--- | :--- |
| **Tier 1 (Service Worker)** | `/sw.js`, `/manifest.webmanifest` | `Cache-Control: no-cache, no-store, must-revalidate` | Prevents clients from permanently caching old service workers; ensures immediate rollout of security patches. |
| **Tier 2 (Immutable Assets)** | `/assets/*` (Vite-hashed JS/CSS/media) | `Cache-Control: public, max-age=31536000, immutable` | Maximizes CDN cache hit rates without risk of stale code, as Vite guarantees unique content hashes per release. |
| **Tier 3 (SPA Entry Point)** | `/index.html`, `/` | `Cache-Control: no-cache` | Ensures browsers always request the latest entry HTML pointing to current asset chunk hashes. |

---

## 3. Reverse Proxy Sub-Path Deployments

PixelTruth is configured with `base: './'` in [vite.config.js](file:///c:/Users/Atharva/Desktop/PixelTruth/vite.config.js). 

When mounting PixelTruth behind a path-based enterprise reverse proxy (e.g., `https://internal.company.com/tools/pixeltruth/`), asset paths automatically resolve relatively to the current path, eliminating hardcoded root routing collisions and broken icons/scripts.

---

## 4. Reference Deployments

### Vercel / Edge CDN
Handled automatically by the root [vercel.json](file:///c:/Users/Atharva/Desktop/PixelTruth/vercel.json).

### Enterprise NGINX / Kubernetes Ingress
Use the pre-configured [nginx/nginx.conf](file:///c:/Users/Atharva/Desktop/PixelTruth/nginx/nginx.conf) which encapsulates:
- Correct MIME bindings for `.wasm` and `.webmanifest`.
- Slowloris and buffer overflow mitigation via tuned buffer sizes and client timeouts.
- Three-tier caching logic.
- SPA fallback routing via `try_files $uri $uri/ /index.html`.
