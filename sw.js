const CACHE_NAME = 'radio-cache-v731212'; // Updated cache version

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
    }).then(() => self.skipWaiting()) // Force immediate activation
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    Promise.all([
      caches.keys().then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            if (cacheName !== CACHE_NAME) {
              return caches.delete(cacheName);
            }
          })
        );
      }),
      self.clients.claim(), // Take control of clients immediately
      self.clients.matchAll({ includeUncontrolled: true }).then((clients) => {
        clients.forEach((client) => {
          client.postMessage({ type: 'CACHE_UPDATED', cacheVersion: CACHE_NAME });
        });
      })
    ])
  );
});

self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request).then((response) => {
      if (event.request.url.endsWith('stations.json')) {
        return fetch(event.request, { cache: 'no-store', signal: new AbortController().signal })
          .then((networkResponse) => {
            if (networkResponse.ok) {
              caches.open(CACHE_NAME).then((cache) => {
                cache.put(event.request, networkResponse.clone());
              });
            }
            return networkResponse;
          })
          .catch(() => caches.match(event.request).then((cachedResponse) => {
            return cachedResponse || caches.match('/index.html');
          }));
      }
      return response || fetch(event.request).then((networkResponse) => {
        if (networkResponse.ok && event.request.method === 'GET') {
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, networkResponse.clone());
          });
        }
        return networkResponse;
      }).catch(() => caches.match('/index.html'));
    })
  );
});

// Network status monitoring
let wasOnline = navigator.onLine;
let checkInterval = null;

function startNetworkCheck() {
  if (!checkInterval) {
    checkInterval = setInterval(() => {
      fetch('/ping.txt', { method: 'HEAD', cache: 'no-store' })
        .then((response) => {
          if (!wasOnline && response.ok) {
            wasOnline = true;
            broadcastNetworkStatus(true);
            stopNetworkCheck(); // Stop polling once online
            broadcastResumePlayback(); // Trigger playback resumption
          }
        })
        .catch(() => {
          if (wasOnline) {
            wasOnline = false;
            broadcastNetworkStatus(false);
          }
        });
    }, 1500); // Reduced polling interval to 1.5 seconds for faster detection
  }
}

function stopNetworkCheck() {
  if (checkInterval) {
    clearInterval(checkInterval);
    checkInterval = null;
  }
}

function broadcastNetworkStatus(online) {
  self.clients.matchAll({ includeUncontrolled: true }).then((clients) => {
    clients.forEach((client) => {
      client.postMessage({ type: 'NETWORK_STATUS', online });
    });
  });
}

function broadcastResumePlayback() {
  self.clients.matchAll({ includeUncontrolled: true }).then((clients) => {
    clients.forEach((client) => {
      client.postMessage({ type: 'RESUME_PLAYBACK' });
    });
  });
}

self.addEventListener('online', () => {
  if (!wasOnline) {
    wasOnline = true;
    broadcastNetworkStatus(true);
    stopNetworkCheck();
    broadcastResumePlayback(); // Trigger playback resumption on network restore
  }
});

self.addEventListener('offline', () => {
  if (wasOnline) {
    wasOnline = false;
    broadcastNetworkStatus(false);
    startNetworkCheck();
  }
});

self.addEventListener('message', (event) => {
  if (event.data.type === 'RESUME_PLAYBACK') {
    console.log('Service Worker: Received RESUME_PLAYBACK message');
    broadcastResumePlayback();
  }
});

// Start initial check if already offline
if (!navigator.onLine && wasOnline) {
  wasOnline = false;
  startNetworkCheck();
}