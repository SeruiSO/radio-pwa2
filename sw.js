const CACHE_NAME = 'radio-cache-v22.1.20250627';

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
      }).catch(() => {
        return caches.match('/index.html');
      });
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
  if (networkCheckInterval) return; // Prevent multiple intervals
  networkCheckInterval = setInterval(() => {
    fetch("https://www.google.com", { method: "HEAD", mode: "no-cors" })
      .then(() => {
        if (!wasOnline) {
          wasOnline = true;
          clearInterval(networkCheckInterval);
          networkCheckInterval = null;
          console.log("Мережа відновлена, припиняємо перевірку");
          self.clients.matchAll().then(clients => {
            clients.forEach(client => {
              client.postMessage({ type: "NETWORK_STATUS", online: true });
            });
          });
        }
      })
      .catch(error => {
        console.error("Помилка перевірки мережі:", error);
        if (wasOnline) {
          wasOnline = false;
          self.clients.matchAll().then(clients => {
            clients.forEach(client => {
              client.postMessage({ type: "NETWORK_STATUS", online: false });
            });
          });
        }
      });
  }, 2000); // Check every 2 seconds
}

self.addEventListener('online', () => {
  wasOnline = true;
  if (networkCheckInterval) {
    clearInterval(networkCheckInterval);
    networkCheckInterval = null;
    console.log("Мережа відновлена");
  }
  self.clients.matchAll().then(clients => {
    clients.forEach(client => {
      client.postMessage({ type: "NETWORK_STATUS", online: true });
    });
  });
});

self.addEventListener('offline', () => {
  wasOnline = false;
  startNetworkCheck();
  console.log("Втрачено з'єднання, запускаємо перевірку мережі");
});