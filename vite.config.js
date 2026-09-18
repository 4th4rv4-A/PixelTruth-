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
      includeAssets: ['favicon.svg', 'icons.svg'],
      manifest: {
        name: 'PixelTruth — Image Metadata Cleaner & AI Detector',
        short_name: 'PixelTruth',
        description: 'Clean image metadata and detect AI-generated images, entirely in your browser. Nothing is ever uploaded.',
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
        // Precache app shell; C2PA WASM chunk should stay lazy-loaded, not precached,
        // since most users only ever use the Clean tab
        globPatterns: ['**/*.{js,css,html,svg,png}'],
        globIgnores: ['**/inline-*.js'],
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
      },
    }),
  ],
})
