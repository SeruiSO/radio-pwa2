```javascript
// Версія кешу для Radio S O
const CACHE_NAME = 'radio-cache-v74';
const CACHE_LIFETIME = 30 * 24 * 60 * 60 * 1000; // 30 днів

// Файли для кешування
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/styles.css',
  '/script.js',
  '/stations.json',
  '/manifest.json',
  '/ping.txt',
  '/icon-192.png',
  '/icon-512.png'
];

// Подія встановлення Service Worker
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS).then(() => {
        // Видаляємо старі кеші після встановлення нового
        return caches.keys().then((cacheNames) => {
          return Promise.all(
            cacheNames.map((cacheName) => {
              if (cacheName !== CACHE_NAME) {
                return caches.delete(cacheName);
              }
            })
          );
        });
      });
    }).then(() => self.skipWaiting())
  );
});

// Подія активації Service Worker
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => {
      // Повідомляємо клієнтів про оновлення кешу
      return self.clients.claim().then(() => {
        self.clients.matchAll().then((clients) => {
          clients.forEach((client) => {
            client.postMessage({ type: 'CACHE_UPDATED', cacheVersion: CACHE_NAME });
          });
        });
      });
    })
  );
});

// Подія отримання ресурсів
self.addEventListener('fetch', (event) => {
  const requestUrl = new URL(event.request.url);

  // Обробка stations.json з стратегією stale-while-revalidate
  if (requestUrl.pathname.endsWith('stations.json')) {
    event.respondWith(
      caches.open(CACHE_NAME).then((cache) => {
        return cache.match(event.request).then((cachedResponse) => {
          const fetchPromise = fetch(event.request, { cache: 'no-store' })
            .then((networkResponse) => {
              cache.put(event.request, networkResponse.clone());
              return networkResponse;
            })
            .catch(() => cachedResponse || caches.match('/index.html'));
          return cachedResponse || fetchPromise;
        });
      })
    );
  } else {
    // Для інших ресурсів використовуємо cache-first
    event.respondWith(
      caches.match(event.request).then((response) => {
        return response || fetch(event.request).then((networkResponse) => {
          if (networkResponse.ok && STATIC_ASSETS.some(asset => requestUrl.pathname.includes(asset))) {
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, networkResponse.clone());
            });
          }
          return networkResponse;
        }).catch(() => caches.match('/index.html'));
      })
    );
  }
});

// Моніторинг стану мережі
let wasOnline = navigator.onLine;
let checkInterval = null;

function startNetworkCheck() {
  if (!checkInterval) {
    checkInterval = setInterval(() => {
      fetch('/ping.txt', { method: 'HEAD', cache: 'no-store' })
        .then(() => {
          if (!wasOnline) {
            wasOnline = true;
            notifyClients({ type: 'NETWORK_STATUS', online: true });
            stopNetworkCheck();
          }
        })
        .catch((error) => {
          if (wasOnline) {
            wasOnline = false;
            notifyClients({ type: 'NETWORK_STATUS', online: false });
          }
          console.error('Network check failed:', error);
        });
    }, 5000); // Перевірка кожні 5 секунд
  }
}

function stopNetworkCheck() {
  if (checkInterval) {
    clearInterval(checkInterval);
    checkInterval = null;
  }
}

function notifyClients(message) {
  self.clients.matchAll({ includeUncontrolled: true }).then((clients) => {
    clients.forEach((client) => {
      client.postMessage(message);
    });
  });
}

// Події зміни статусу мережі
self.addEventListener('online', () => {
  if (!wasOnline) {
    wasOnline = true;
    notifyClients({ type: 'NETWORK_STATUS', online: true });
    stopNetworkCheck();
  }
});

self.addEventListener('offline', () => {
  if (wasOnline) {
    wasOnline = false;
    notifyClients({ type: 'NETWORK_STATUS', online: false });
    startNetworkCheck();
  }
});

// Початкова перевірка, якщо офлайн
if (!navigator.onLine && wasOnline) {
  wasOnline = false;
  startNetworkCheck();
}
```