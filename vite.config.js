import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')

  const appName      = env.VITE_APP_NAME        || 'My Solid App'
  const appShortName = env.VITE_APP_SHORT_NAME   || appName
  const appDesc      = env.VITE_APP_DESCRIPTION  || 'A Solid Pod application'
  const themeColor   = env.VITE_THEME_COLOR      || '#1A73E8'
  const bgColor      = env.VITE_BG_COLOR         || '#F8F9FA'

  return {
    plugins: [
      react(),
      VitePWA({
        registerType: 'autoUpdate',
        includeAssets: ['icons/apple-touch-icon.png', 'icons/icon.svg'],
        manifest: {
          name: appName,
          short_name: appShortName,
          description: appDesc,
          theme_color: themeColor,
          background_color: bgColor,
          display: 'standalone',
          orientation: 'portrait',
          scope: '/',
          start_url: '/',
          icons: [
            { src: 'icons/pwa-64x64.png',           sizes: '64x64',   type: 'image/png' },
            { src: 'icons/pwa-192x192.png',          sizes: '192x192', type: 'image/png' },
            { src: 'icons/pwa-512x512.png',          sizes: '512x512', type: 'image/png' },
            { src: 'icons/maskable-icon-512x512.png',sizes: '512x512', type: 'image/png', purpose: 'maskable' },
          ],
        },
        workbox: {
          // Cache the app shell; Solid API calls always go to network
          navigateFallback: 'index.html',
          globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
          runtimeCaching: [
            {
              // Solid Pod requests — network first, fall back to cache
              urlPattern: ({ url }) => url.hostname.endsWith('privatedatapod.com'),
              handler: 'NetworkFirst',
              options: {
                cacheName: 'solid-pod-cache',
                networkTimeoutSeconds: 10,
              },
            },
          ],
        },
      }),
    ],
    define: {
      // Some RDF/Solid packages reference global
      global: 'globalThis',
    },
    optimizeDeps: {
      include: [
        '@inrupt/solid-client-authn-browser',
        '@inrupt/solid-client',
      ],
    },
  }
})
