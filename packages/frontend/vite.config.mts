import path from 'path';
import { fileURLToPath } from 'url';
import { defineConfig, type UserConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import mkcert from 'vite-plugin-mkcert';
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'
import { devLiveServer } from './devLiveServer'
import { devMpServer } from './devMpServer'

export default defineConfig(({ command }) => {
  return {
    plugins: [
      vue(),
      mkcert(),
      tailwindcss(),
      // Live-Spiele im Demo-Modus (nur lokaler Dev-Server, siehe devLiveServer.ts)
      devLiveServer(),
      // Anstoss-Lobbys im Demo-Modus (siehe devMpServer.ts)
      devMpServer(),

      // PWA plugin configuration
      VitePWA({
        registerType: 'autoUpdate',
        includeAssets: ['favicon.png', 'metaImage.jpg'],
        workbox: {
          // Delete old caches on update
          cleanupOutdatedCaches: true,
          // Take control immediately
          clientsClaim: true,
          // Force immediate activation
          skipWaiting: true,
          // Push-Benachrichtigungen (public/push-sw.js)
          importScripts: ['push-sw.js'],

          // Only precache the app shell (HTML, JS, CSS) - NOT images
          globPatterns: [
            '**/*.{html,js,css,woff2}'
          ],
          // Seitenaufrufe liefert der Service Worker aus dem Precache (index.html, navigateFallback).
          // Neue Versionen kommen ueber das Update des Service Workers (src/util/pwaUpdate.ts).
          runtimeCaching: [
            {
              // Cache images on demand (not precached)
              urlPattern: ({ request }) => request.destination === 'image',
              handler: 'CacheFirst',
              options: {
                cacheName: 'images-cache',
                expiration: {
                  maxEntries: 200,
                  maxAgeSeconds: 60 * 60 * 24 * 30 // 30 days
                }
              }
            },
            {
              // GET requests to backend
              urlPattern: /^https:\/\/bipoopen-backend\.vercel\.app\/.*/,
              handler: 'NetworkFirst',
              method: 'GET',
              options: {
                cacheName: 'backend-api-cache',
                // Alter Stand nur, wenn das Netz wirklich weg ist oder haengt, nicht schon bei einem
                // langsamen Kaltstart des Backends (sonst sieht man veraltete Spiele und Spielzahlen)
                networkTimeoutSeconds: 15,
                expiration: {
                  maxEntries: 100,
                  maxAgeSeconds: 60 * 60 * 24 * 7 // 7 days
                },
                cacheableResponse: {
                  statuses: [0, 200]
                }
              }
            }
          ]
        },
        devOptions: {
          enabled: true
        },
        manifest: {
          name: 'Weck BiPo Open',
          short_name: 'Weck BiPo Open',
          description: 'Professionelles Bierpong Turnier seit 2020',
          theme_color: '#1B1E22',
          background_color: '#1B1E22',
          display: 'standalone',
          start_url: '/',
          scope: '/',
          icons: [
            {
              src: '/pwa-icon-192.png',
              sizes: '192x192',
              type: 'image/png'
            },
            {
              src: '/pwa-icon-512.png',
              sizes: '512x512',
              type: 'image/png',
            },
            {
              src: '/pwa-icon-512-maskable.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'maskable'
            }
          ]
        }
      })
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      }
    },
    server: {
      host: true,
      open: true
    },
    build: {
      rollupOptions: {
        input: {
          main: fileURLToPath(new URL('./index.html', import.meta.url)),
        },
      },
    }
  } satisfies UserConfig;
})