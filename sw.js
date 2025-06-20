const CACHE_NAME = 'radio-cache-v43.1.20250618';

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll([
        '/',
        '/index.html',
        '/styles.css',
        '/script.js',
        '/stations.json',
        '/manifest.json',
        '/ping.txt' // Додаємо ping.txt до кешу
      ]).then(() => {
        caches.keys().then((cacheNames) => {
          return Promise.all(cacheNames.map((cacheName) => {
            if (cacheName !== CACHE_NAME) {
              return caches.delete(cacheName);
            }
          }));
        });
      });
    })
  );
});

self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request).then((response) => {
      if (event.request.url.endsWith('stations.json')) {
        return fetch(event.request, { cache: 'no-store', signal: new AbortController().signal }).then((networkResponse) => {
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, networkResponse.clone());
          });
          return networkResponse;
        }).catch(() => caches.match('/index.html'));
      }
      return response || fetch(event.request).then((networkResponse) => {
        return networkResponse;
      }).catch(() => caches.match('/index.html'));
    })
  );
});

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
    })
  );
  self.clients.matchAll().then((clients) => {
    clients.forEach((client) => {
      client.postMessage({ type: 'CACHE_UPDATED', cacheVersion: CACHE_NAME });
    });
  });
});

// Моніторинг стану мережі
let wasOnline = navigator.onLine;
let networkCheckInterval = null;

function startNetworkCheck() {
  if (networkCheckInterval) return; // Уникаємо дублювання інтервалу
  networkCheckInterval = setInterval(() => {
    const isOnline = navigator.onLine;
    if (isOnline !== wasOnline) {
      // Якщо navigator.onLine змінився, проводимо вторинну перевірку
      fetch('/ping.txt', { method: 'HEAD', cache: 'no-store' })
        .then(() => {
          if (!wasOnline) {
            wasOnline = true;
            console.log('Мережа відновлена (SW)');
            self.clients.matchAll().then(clients => {
              clients.forEach(client => {
                client.postMessage({ type: 'NETWORK_STATUS', online: true });
              });
            });
            clearInterval(networkCheckInterval); // Зупиняємо перевірку після відновлення
            networkCheckInterval = null;
          }
        })
        .catch(error => {
          if (wasOnline) {
            wasOnline = false;
            console.error('Втрачено зв’язок (SW):', error);
            self.clients.matchAll().then(clients => {
              clients.forEach(client => {
                client.postMessage({ type: 'NETWORK_STATUS', online: false });
              });
            });
          }
        });
    }
  }, 2000); // Інтервал 2 секунди
}

function stopNetworkCheck() {
  if (networkCheckInterval) {
    clearInterval(networkCheckInterval);
    networkCheckInterval = null;
  }
}

// Запускаємо перевірку, якщо пристрій офлайн
if (!navigator.onLine) {
  startNetworkCheck();
}

// Слухаємо зміни статусу мережі
self.addEventListener('online', () => {
  if (!wasOnline) {
    wasOnline = true;
    console.log('Мережа відновлена (SW)');
    self.clients.matchAll().then(clients => {
      clients.forEach(client => {
        client.postMessage({ type: 'NETWORK_STATUS', online: true });
      });
    });
    stopNetworkCheck();
  }
});

self.addEventListener('offline', () => {
  if (wasOnline) {
    wasOnline = false;
    console.error('Втрачено зв’язок (SW)');
    self.clients.matchAll().then(clients => {
      clients.forEach(client => {
        client.postMessage({ type: 'NETWORK_STATUS', online: false });
      });
    });
    startNetworkCheck();
  }
});