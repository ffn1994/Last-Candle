/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import legacy from '@vitejs/plugin-legacy';
import { browserslistToTargets } from 'lightningcss';
import browserslist from 'browserslist';
import { VitePWA } from 'vite-plugin-pwa';

// Oldest browsers we support: smart TVs from ~2021 (Chromium 79), iPadOS/iOS 14.
const SUPPORTED = ['chrome >= 79', 'edge >= 79', 'safari >= 14', 'ios >= 14', 'firefox >= 78', 'samsung >= 12'];

export default defineConfig({
  css: {
    // Tailwind runs through PostCSS; Lightning CSS then lowers newer CSS
    // (inset, logical margins, …) for the targets below when minifying.
    lightningcss: { targets: browserslistToTargets(browserslist(SUPPORTED)) },
  },
  plugins: [
    react(),
    // Older smart-TV / tablet browsers: syntax lowered + only the polyfills they need.
    legacy({
      modernTargets: SUPPORTED,
      modernPolyfills: true,
      renderLegacyChunks: false,
    }),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icons/icon.svg', 'icons/apple-touch-icon.png'],
      manifest: {
        name: 'Last Candle',
        short_name: 'Last Candle',
        description: 'الشمعة الأخيرة — لعبة نجاة في التداول تعلّمك إدارة المخاطر والانضباط.',
        lang: 'ar',
        dir: 'rtl',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        orientation: 'any',
        background_color: '#0B0E11',
        theme_color: '#0B0E11',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/fonts\.(googleapis|gstatic)\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts',
              expiration: { maxEntries: 20, maxAgeSeconds: 60 * 60 * 24 * 365 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
    }),
  ],
  build: {
    cssMinify: 'lightningcss',
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: [
            { name: 'charts', test: /node_modules[\\/]lightweight-charts/ },
            { name: 'motion', test: /node_modules[\\/](framer-motion|motion-dom|motion-utils)/ },
            { name: 'vendor', test: /node_modules/ },
          ],
        },
      },
    },
  },
  test: { include: ['src/**/*.test.ts'] },
});
