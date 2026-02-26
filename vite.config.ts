import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react-swc'
// 暫時註解掉 PWA 引用，排除路徑與快取干擾
// import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig(({ command, mode }) => {
  return {
    // 為了相容 GitHub Pages 子目錄，生產環境使用 '/ju-smile-app/'
    base: command === 'serve' ? '/' : '/ju-smile-app/',
    plugins: [
      react(),
      /* 暫時移除 PWA 功能測試
      VitePWA({
        registerType: 'prompt',
        injectRegister: 'auto',
        workbox: {
          cleanupOutdatedCaches: true,
          skipWaiting: true,
          clientsClaim: true,
          globPatterns: ['**/*.{ js, css, html, ico, png, svg, webp, woff, woff2 }'],
        },
    manifest: {
    name: 'Ju Smile App',
      short_name: 'Ju Smile',
        description: '飲食與運動記錄 App',
          theme_color: '#5c9c84',
            background_color: '#ffffff',
              display: 'standalone',
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
      */
    ],
  };
});