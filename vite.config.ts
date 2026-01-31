import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react-swc'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig(({ command, mode }) => {
  return {
    // 為了相容 GitHub Pages 與 Capacitor，生產環境統一使用相對路徑 './'
    base: command === 'serve' ? '/' : './',
    plugins: [
      react(),
      VitePWA({
        registerType: 'prompt',
        injectRegister: 'auto',
        workbox: {
          cleanupOutdatedCaches: true,
          skipWaiting: false,
          clientsClaim: false,
          globPatterns: ['**/*.{js,css,html,ico,png,svg,webp,woff,woff2}'],
        },
        manifest: {
          name: 'Ju Smile App',
          short_name: 'Ju Smile',
          description: '飲食與運動記錄 App',
          theme_color: '#5c9c84',
          background_color: '#ffffff',
          display: 'standalone',
          // 確保在原生環境下 start_url 是相對的
          start_url: './index.html',
          scope: './',
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
  }; // 這裡修正了結尾括號
});