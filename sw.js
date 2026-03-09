const CACHE_NAME = 'radio-cache-v82';

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
  self.skipWaiting();
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  
  // ==================== NEW: Handle Radio Browser API requests ====================
  if (url.hostname.includes('radio-browser.info') || url.hostname.includes('api.radio-browser')) {
    event.respondWith(
      fetch(event.request, { 
        cache: 'no-store',
        signal: new AbortController().signal 
      }).then((networkResponse) => {
        return networkResponse;
      }).catch(() => {
        // Return empty JSON for API failures when offline
        return new Response(JSON.stringify([]), {
          headers: { 'Content-Type': 'application/json' }
        });
      })
    );
    return;
  }
  
  // ==================== NEW: Handle audio stream requests ====================
  if (event.request.url.endsWith('.mp3') || 
      event.request.url.endsWith('.aac') || 
      event.request.url.endsWith('.ogg') ||
      event.request.url.endsWith('.m3u') ||
      event.request.url.endsWith('.m3u8') ||
      event.request.url.endsWith('.pls') ||
      url.pathname.includes('stream') ||
      url.pathname.includes('listen')) {
    event.respondWith(
      fetch(event.request, { 
        cache: 'no-store',
        mode: 'cors',
        credentials: 'omit'
      }).catch(() => {
        return new Response('', { status: 503, statusText: 'Service Unavailable' });
      })
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then((response) => {
      // ==================== UPDATED: stations.json always fresh ====================
      if (event.request.url.endsWith('stations.json')) {
        return fetch(event.request, { 
          cache: 'no-store', 
          signal: new AbortController().signal 
        }).then((networkResponse) => {
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, networkResponse.clone());
          });
          return networkResponse;
        }).catch(() => {
          // Return cached version or fallback
          return response || caches.match('/index.html');
        });
      }
      
      // ==================== NEW: Network-first strategy for HTML ====================
      if (event.request.mode === 'navigate' || event.request.headers.get('accept').includes('text/html')) {
        return fetch(event.request).then((networkResponse) => {
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, networkResponse.clone());
          });
          return networkResponse;
        }).catch(() => {
          return response || caches.match('/index.html');
        });
      }
      
      // Cache-first for static assets
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
  self.clients.claim();
  self.clients.matchAll().then((clients) => {
    clients.forEach((client) => {
      client.postMessage({ type: 'CACHE_UPDATED', cacheVersion: CACHE_NAME });
    });
  });
});

// ==================== NEW: Background sync for offline actions ====================
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-stations') {
    event.waitUntil(syncStations());
  }
});

async function syncStations() {
  const clients = await self.clients.matchAll();
  clients.forEach(client => {
    client.postMessage({ type: 'SYNC_COMPLETE' });
  });
}

// Моніторинг стану мережі
let wasOnline = navigator.onLine;
let checkInterval = null;

function startNetworkCheck() {
  if (!checkInterval) {
    checkInterval = setInterval(() => {
      fetch("/ping.txt", { method: "HEAD", cache: "no-store" })
        .then(() => {
          if (!wasOnline) {
            wasOnline = true;
            self.clients.matchAll().then(clients => {
              clients.forEach(client => {
                client.postMessage({ type: "NETWORK_STATUS", online: true });
              });
            });
            stopNetworkCheck();
          }
        })
        .catch(error => {
          if (wasOnline) {
            wasOnline = false;
            self.clients.matchAll().then(clients => {
              clients.forEach(client => {
                client.postMessage({ type: "NETWORK_STATUS", online: false });
              });
            });
          }
        });
    }, 2000);
  }
}

function stopNetworkCheck() {
  if (checkInterval) {
    clearInterval(checkInterval);
    checkInterval = null;
  }
}

self.addEventListener('online', () => {
  if (!wasOnline) {
    wasOnline = true;
    self.clients.matchAll().then(clients => {
      clients.forEach(client => {
        client.postMessage({ type: "NETWORK_STATUS", online: true });
      });
    });
    stopNetworkCheck();
  }
});

self.addEventListener('offline', () => {
  if (wasOnline) {
    wasOnline = false;
    self.clients.matchAll().then(clients => {
      clients.forEach(client => {
        client.postMessage({ type: "NETWORK_STATUS", online: false });
      });
    });
    startNetworkCheck();
  }
});

// Start initial check if already offline
if (!navigator.onLine && wasOnline) {
  wasOnline = false;
  startNetworkCheck();
}

// ==================== NEW: Push notifications support ====================
self.addEventListener('push', (event) => {
  const data = event.data.json();
  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: 'icon-192.png',
      badge: 'icon-192.png',
      tag: data.tag || 'radio-notification'
    })
  );
});

// ==================== NEW: Notification click handler ====================
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients.openWindow('/')
  );
});