// public/service-worker.js

const CACHE_NAME = 'ju-smile-app-cache-v2';

// 安裝時直接啟用新的 SW
self.addEventListener('install', (event) => {
  self.skipWaiting();
});

// 啟用時清掉舊的 cache，並接管所有 clients
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys.map((key) => {
            if (key !== CACHE_NAME) {
              return caches.delete(key);
            }
          })
        )
      )
      .then(() => self.clients.claim())
  );
});

// fetch 策略
self.addEventListener('fetch', (event) => {
  const request = event.request;

  // 只處理 GET
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  // 只處理 http/https，並且限制同一個 origin
  if (
    (url.protocol !== 'http:' && url.protocol !== 'https:') ||
    url.origin !== self.location.origin
  ) {
    // 例如 chrome-extension://... 就會直接略過，不用 SW 處理
    return;
  }

  // HTML 導覽頁：network-first（有網路就抓新版）
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            // 保險一點避免 cache.put 失敗直接丟錯
            cache.put(request, copy).catch((err) => {
              console.warn('Cache put failed (navigate):', err);
            });
          });
          return response;
        })
        .catch(async () => {
          // 線上抓不到就用 cache，最後退回 index.html
          const cache = await caches.open(CACHE_NAME);
          const cached = await cache.match(request);
          if (cached) return cached;
          return cache.match('/ju-smile-app/index.html');
          // 如果你的專案路徑是 ju-smile-calorie-app，要改成：
          // return cache.match('/ju-smile-calorie-app/index.html');
        })
    );
    return;
  }

  // 其他靜態檔：cache-first
  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(request, copy).catch((err) => {
              console.warn('Cache put failed:', err);
            });
          });
          return response;
        })
        .catch((err) => {
          // 線上抓不到、cache 也沒命中就直接丟錯或自己加離線備案
          console.warn('Fetch failed:', err);
          throw err;
        });
    })
  );
});

// 收到前端的 SKIP_WAITING 訊息 → 立刻啟用新版 SW
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
