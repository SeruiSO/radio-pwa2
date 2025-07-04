const CACHE_NAME = 'radio-cache-v944.1.20250984';

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll([
        '/',
        '/index.html',
        '/styles.css',
        '/script.js',
        '/stations.json',
        '/manifest.json'
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

async function checkNetwork() {
  try {
    const response = await Promise.race([
      fetch("https://radioso2.netlify.app/favicon.ico", { method: "HEAD" }),
      new Promise((_, reject) => setTimeout(() => reject(new Error("Timeout")), 1000))
    ]);
    return response.ok;
  } catch {
    return false;
  }
}

setInterval(() => {
  checkNetwork().then((isOnline) => {
    if (isOnline && !wasOnline) {
      wasOnline = true;
      self.clients.matchAll().then(clients => {
        clients.forEach(client => {
          client.postMessage({ type: "NETWORK_STATUS", online: true });
        });
      });
    } else if (!isOnline && wasOnline) {
      wasOnline = false;
      self.clients.matchAll().then(clients => {
        clients.forEach(client => {
          client.postMessage({ type: "NETWORK_STATUS", online: false });
        });
      });
    }
  });
}, 2000); // Збільшено інтервал до 2 секунд