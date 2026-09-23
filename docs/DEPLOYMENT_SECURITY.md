# Deployment Security Configuration

When deploying PixelTruth to a production environment (like Vercel, Netlify, or Nginx), specific HTTP security headers are required to maintain the application's strict security posture.

## Required Headers

PixelTruth includes a `vercel.json` file at the root of the repository that automatically applies these headers. If you are deploying elsewhere, you must configure your server to inject the following:

### 1. Content Security Policy (CSP)
```http
Content-Security-Policy: default-src 'self'; script-src 'self' 'wasm-unsafe-eval' blob:; style-src 'self' 'unsafe-inline'; font-src 'self'; img-src 'self' blob: data:; connect-src 'self' blob: data:; worker-src 'self' blob:; child-src 'self' blob:; object-src 'none'; base-uri 'self'; form-action 'none'; frame-ancestors 'none';
```
*Note: `unsafe-eval` is explicitly prohibited. `wasm-unsafe-eval` is allowed strictly for the ONNX and C2PA WebAssembly runtimes.*

### 2. Strict-Transport-Security (HSTS)
```http
Strict-Transport-Security: max-age=31536000; includeSubDomains; preload
```
*Enforces HTTPS connections to prevent man-in-the-middle attacks.*

### 3. X-Content-Type-Options
```http
X-Content-Type-Options: nosniff
```
*Prevents MIME-sniffing attacks.*

### 4. Referrer-Policy
```http
Referrer-Policy: strict-origin-when-cross-origin
```
*Limits referrer leakage when linking out (if applicable).*

### 5. Permissions-Policy
```http
Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=()
```
*PixelTruth does not require any hardware sensors. They are explicitly disabled.*

## Build Artifacts & Source Control
- The `dist/` folder is strictly ignored in `.gitignore`. It is a build artifact and must never be committed as the source of truth.
- Do not check in `.env.local` or any production secrets.

## Service Worker (PWA) Update Strategy
The application uses `vite-plugin-pwa` with `registerType: 'prompt'`. This configuration is intentional. It prevents the Service Worker from forcefully updating and reloading the application while a user is actively processing a large batch of images, which would result in data loss.
