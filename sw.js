const CACHE_NAME = 'radio-cache-v98.2-20250699';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/styles.css',
  '/script.js',
  '/stations.json',
  '/manifest.json'
];

// Установка Service Worker і кешування статичних ресурсів
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS).then(() => {
        return caches.keys().then((cacheNames) => {
          return Promise.all(
            cacheNames.map((cacheName) => {
              if (cacheName !== CACHE_NAME) {
                console.log(`Deleting old cache: ${cacheName}`);
                return caches.delete(cacheName);
              }
            })
          );
        });
      });
    }).then(() => self.skipWaiting())
  );
});

// Активація Service Worker і очищення старих кешів
self.addEventListener('activate', (event) => {
  event.waitUntil(
    Promise.all([
      caches.keys().then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            if (cacheName !== CACHE_NAME) {
              console.log(`Deleting old cache during activation: ${cacheName}`);
              return caches.delete(cacheName);
            }
          })
        );
      }),
      self.clients.claim().then(() => {
        return self.clients.matchAll({ type: 'window' }).then((clients) => {
          clients.forEach((client) => {
            client.postMessage({ type: 'CACHE_UPDATED', cacheVersion: CACHE_NAME });
          });
        });
      })
    ])
  );
});

// Обробка запитів
self.addEventListener('fetch', (event) => {
  const requestUrl = new URL(event.request.url);

  // Пропускати запити до сторонніх ресурсів (наприклад, потоки <audio>) без кешування
  if (!requestUrl.origin.includes(self.location.origin)) {
    event.respondWith(fetch(event.request, { cache: 'no-store' }));
    return;
  }

  // Обробка stations.json: завжди отримувати свіжу версію
  if (requestUrl.pathname.endsWith('stations.json')) {
    event.respondWith(
      fetch(event.request, { cache: 'no-store', signal: new AbortController().signal })
        .then((networkResponse) => {
          if (networkResponse.ok) {
            return caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, networkResponse.clone());
              return networkResponse;
            });
          }
          return caches.match(event.request).then((cachedResponse) => cachedResponse || new Response('Offline', { status: 503 }));
        })
        .catch(() => {
          return caches.match(event.request).then((cachedResponse) => cachedResponse || caches.match('/index.html'));
        })
    );
    return;
  }

  // Обробка статичних ресурсів
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      const fetchPromise = fetch(event.request, { cache: 'no-store' }).then((networkResponse) => {
        if (networkResponse.ok && STATIC_ASSETS.includes(requestUrl.pathname)) {
          return caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, networkResponse.clone());
            return networkResponse;
          });
        }
        return networkResponse;
      }).catch(() => {
        return cachedResponse || caches.match('/index.html');
      });
      return cachedResponse || fetchPromise;
    })
  );
});

// Моніторинг стану мережі
let wasOnline = navigator.onLine;
let networkCheckTimeout = null;

function checkNetworkStatus() {
  fetch('https://www.google.com/favicon.ico', { method: 'HEAD', mode: 'no-cors', cache: 'no-store' })
    .then(() => {
      if (!wasOnline) {
        wasOnline = true;
        console.log('SW: Network restored');
        notifyClients({ type: 'NETWORK_STATUS', online: true });
      }
    })
    .catch(() => {
      if (wasOnline) {
        wasOnline = false;
        console.log('SW: Network lost');
        notifyClients({ type: 'NETWORK_STATUS', online: false });
      }
    })
    .finally(() => {
      networkCheckTimeout = setTimeout(checkNetworkStatus, 1000); // Перевірка кожну секунду
    });
}

function notifyClients(message) {
  self.clients.matchAll({ type: 'window' }).then((clients) => {
    clients.forEach((client) => {
      client.postMessage(message);
    });
  });
}

// Запуск перевірки мережі
checkNetworkStatus();

// Обробка Background Sync для відновлення відтворення
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-playback') {
    event.waitUntil(checkNetworkStatus());
  }
});

// Очищення таймаута при деактивації
self.addEventListener('deactivate', () => {
  if (networkCheckTimeout) {
    clearTimeout(networkCheckTimeout);
    networkCheckTimeout = null;
  }
});