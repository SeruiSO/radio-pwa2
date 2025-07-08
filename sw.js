const CACHE_NAME = 'radio-cache-v8579.1.95250799';

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
        '/ping.txt'
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
  const url = new URL(event.request.url);
  if (url.pathname === '/stations.json') {
    event.respondWith(
      fetch(event.request, { cache: 'no-store', signal: new AbortController().signal })
        .then((networkResponse) => {
          if (networkResponse.ok) {
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, networkResponse.clone());
            });
            self.clients.matchAll().then(clients => {
              clients.forEach(client => {
                client.postMessage({
                  type: 'CACHE_UPDATED',
                  cacheVersion: CACHE_NAME
                });
              });
            });
          }
          return networkResponse;
        })
        .catch(() => caches.match(event.request))
    );
  } else {
    event.respondWith(
      caches.match(event.request)
        .then((response) => {
          return response || fetch(event.request).catch(() => {
            if (event.request.mode === 'navigate') {
              return caches.match('/index.html');
            }
          });
        })
    );
  }
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
    }).then(() => self.clients.claim())
  );
  self.clients.matchAll().then((clients) => {
    clients.forEach((client) => {
      client.postMessage({ type: 'CACHE_UPDATED', cacheVersion: CACHE_NAME });
    });
  });
});

// Network status checking
let isOnline = navigator.onLine;
let lastStatus = isOnline;
let networkCheckInterval = null;

function checkNetworkStatus() {
  fetch('/ping.txt', { method: 'HEAD', cache: 'no-store' })
    .then(response => {
      if (response.ok && !isOnline) {
        isOnline = true;
        if (lastStatus !== isOnline) {
          console.log('SW: Network restored');
          self.clients.matchAll().then(clients => {
            clients.forEach(client => {
              client.postMessage({
                type: 'NETWORK_STATUS',
                online: true
              });
            });
          });
          // Stop checking after network is restored
          clearInterval(networkCheckInterval);
          networkCheckInterval = null;
        }
      }
      lastStatus = isOnline;
    })
    .catch(error => {
      if (isOnline) {
        isOnline = false;
        if (lastStatus !== isOnline) {
          console.log('SW: Network lost', error);
          self.clients.matchAll().then(clients => {
            clients.forEach(client => {
              client.postMessage({
                type: 'NETWORK_STATUS',
                online: false
              });
            });
          });
        }
      }
      lastStatus = isOnline;
    });
}

self.addEventListener('message', event => {
  if (event.data && event.data.type === 'CHECK_NETWORK') {
    if (!isOnline && !networkCheckInterval) {
      console.log('SW: Starting network check on demand');
      checkNetworkStatus();
      networkCheckInterval = setInterval(checkNetworkStatus, 5000); // Збільшено інтервал до 5 секунд
    }
  }
});

// Start network check on offline event
self.addEventListener('offline', () => {
  if (isOnline) {
    isOnline = false;
    console.log('SW: Offline event triggered');
    self.clients.matchAll().then(clients => {
      clients.forEach(client => {
        client.postMessage({
          type: 'NETWORK_STATUS',
          online: false
        });
      });
    });
    if (!networkCheckInterval) {
      console.log('SW: Starting network check after offline event');
      networkCheckInterval = setInterval(checkNetworkStatus, 5000); // Збільшено інтервал до 5 секунд
    }
  }
  lastStatus = isOnline;
});

// Stop network check on online event
self.addEventListener('online', () => {
  if (!isOnline) {
    isOnline = true;
    console.log('SW: Online event triggered');
    self.clients.matchAll().then(clients => {
      clients.forEach(client => {
        client.postMessage({
          type: 'NETWORK_STATUS',
          online: true
        });
      });
    });
    if (networkCheckInterval) {
      console.log('SW: Stopping network check after online event');
      clearInterval(networkCheckInterval);
      networkCheckInterval = null;
    }
  }
  lastStatus = isOnline;
});