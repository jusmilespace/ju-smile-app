import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './styles.css';

// 1. 建立 Root
const rootElement = document.getElementById('root');
if (!rootElement) throw new Error('Failed to find the root element');

// 2. 渲染 App (加入 StrictMode 讓 React 幫你檢查潛在問題)
ReactDOM.createRoot(rootElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

// 3. 註冊 Service Worker (改用動態路徑)
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    // import.meta.env.BASE_URL 會自動根據 vite.config.ts 的 base 設定改變
    // 本機開發時是 '/' -> 註冊 '/sw.js'
    // GitHub Pages 時是 '/ju-smile-app/' -> 註冊 '/ju-smile-app/sw.js'
    const swUrl = `${import.meta.env.BASE_URL}sw.js`;

    navigator.serviceWorker
      .register(swUrl)
      .then((registration) => {
        console.log('SW registered: ', registration);
      })
      .catch((registrationError) => {
        console.log('SW registration failed: ', registrationError);
      });
  });
}