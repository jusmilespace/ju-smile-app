import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react-swc'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  base: '/ju-smile-app/',
  plugins: [
    react(),
    VitePWA({
      registerType: 'prompt',
      // 🆕 加入這個，讓每次打包都產生不同的 hash
      injectRegister: 'auto',
      workbox: {
        cleanupOutdatedCaches: true,
        // 🆕 確保這兩個是 false
        skipWaiting: false,
        clientsClaim: false,
        // 🆕 加入版本控制
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
            src: 'pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png'
          }
        ]
      }
    })
  ]
})