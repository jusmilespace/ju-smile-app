import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react-swc'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig(({ command }) => {
  return {
    base: command === 'serve' ? '/' : '/ju-smile-app/',
    plugins: [
      react(),
      VitePWA({
        registerType: 'autoUpdate',
        injectRegister: 'auto',
        workbox: {
          cleanupOutdatedCaches: true,
          skipWaiting: true,
          clientsClaim: true,
          globPatterns: ['**/*.{js,css,html,ico,png,svg,webp,woff,woff2}'],
        },
        manifest: {
          name: 'Ju Smile App',
          short_name: 'Ju Smile',
          description: '飲食與運動記錄 App',
          theme_color: '#5c9c84',
          background_color: '#ffffff',
          display: 'standalone',
          start_url: '/ju-smile-app/',
          scope: '/ju-smile-app/',
          icons: [
            {
              src: 'icons/ju-smile-icon-192x192.png',
              sizes: '192x192',
              type: 'image/png',
            },
            {
              src: 'icons/ju-smile-icon-512x512.png',
              sizes: '512x512',
              type: 'image/png',
            },
          ],
        },
      }),
    ],
  }
})