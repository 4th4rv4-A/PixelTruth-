import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: null,
      devOptions: {
        enabled: true,
      },
      includeAssets: ['favicon.svg', 'icons.svg'],
      manifest: {
        name: 'PixelTruth — Image Metadata Remover',
        short_name: 'PixelTruth',
        description: 'Remove EXIF, GPS, and other metadata from your images entirely in your browser. Nothing is ever uploaded.',
        theme_color: '#0D9488',
        background_color: '#ffffff',
        display: 'standalone',
        start_url: '/',
        icons: [
          { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: '/icon-512-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // Precache app shell; keep *.wasm guard to prevent future dependencies from
        // silently precaching multi-megabyte binaries
        globPatterns: ['**/*.{js,css,html,svg,png}'],
        globIgnores: ['**/inline-*.js', '**/*.wasm', '**/c2pa.worker-*.js', '**/c2pa_worker-*.js'],
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
      },
    }),
  ],
  test: {
    exclude: ['node_modules', 'dist', 'tests/e2e/**'],
  }
})
