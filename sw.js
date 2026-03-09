const CACHE_NAME = 'radio-music-v77';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/styles.css',
  '/script.js',
  '/stations.json',
  '/manifest.json',
  '/ping.txt'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS);
    }).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  
  if (request.method !== 'GET') return;
  
  // Skip audio streams
  const url = request.url.toLowerCase();
  if (url.includes('.mp3') || url.includes('.aac') || url.includes('.ogg') || 
      url.includes('stream') || url.includes('icecast') || url.includes('shoutcast')) {
    return;
  }
  
  // API - network only
  if (url.includes('radio-browser.info') || url.includes('api.')) {
    event.respondWith(
      fetch(request).catch(() => 
        new Response(JSON.stringify({ error: 'offline' }), {
          status: 503,
          headers: { 'Content-Type': 'application/json' }
        })
      )
    );
    return;
  }
  
  // stations.json - stale while revalidate
  if (url.endsWith('stations.json')) {
    event.respondWith(
      caches.open(CACHE_NAME).then((cache) => {
        return cache.match(request).then((cached) => {
          const fetchPromise = fetch(request, { cache: 'no-store' })
            .then((networkResponse) => {
              if (networkResponse.ok) {
                cache.put(request, networkResponse.clone());
              }
              return networkResponse;
            })
            .catch(() => cached);
          
          return cached || fetchPromise;
        });
      })
    );
    return;
  }
  
  // Static assets - cache first
  event.respondWith(
    caches.match(request).then((cached) => {
      return cached || fetch(request).then((response) => {
        if (response.ok && STATIC_ASSETS.some(a => url.endsWith(a))) {
          return caches.open(CACHE_NAME).then((cache) => {
            cache.put(request, response.clone());
            return response;
          });
        }
        return response;
      });
    })
  );
});