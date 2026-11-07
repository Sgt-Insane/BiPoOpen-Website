import path from 'path';
import { fileURLToPath } from 'url';
import { defineConfig, type UserConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import mkcert from 'vite-plugin-mkcert';
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig(({ command }) => {
  return {
    plugins: [
      vue(),
      mkcert(),
      tailwindcss(),

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
          runtimeCaching: [
            {
              // Network-First for HTML navigations
              urlPattern: ({ request }) => request.mode === 'navigate',
              handler: 'NetworkFirst',
              options: {
                cacheName: 'pages-cache',
                networkTimeoutSeconds: 5
              }
            },
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
                networkTimeoutSeconds: 5,
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