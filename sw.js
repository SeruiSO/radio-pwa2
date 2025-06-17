const CACHE_NAME = 'radio-pwa-cache-v100';
const urlsToCache = [
  '/',
  '/index.html',
  '/styles.css',
  '/script.js',
  '/manifest.json',
  '/icon-192.png',
  '/icon-512.png',
  '/stations.json'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Кешування файлів:', urlsToCache);
        return cache.addAll(urlsToCache);
      })
      .then(() => self.skipWaiting())
      .catch(error => console.error('Помилка при кешуванні:', error))
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cache => {
          if (cache !== CACHE_NAME) {
            console.log('Видалення старого кешу:', cache);
            return caches.delete(cache);
          }
        })
      );
    })
    .then(() => caches.open(CACHE_NAME).then(cache => cache.keys().then(keys => {
      return Promise.all(keys.map(key => {
        if (key.url.endsWith('stations.json')) {
          console.log('Видалення старого stations.json з кешу');
          return cache.delete(key);
        }
      }));
    })))
    .then(() => {
      console.log('Активація нового Service Worker');
      return self.clients.claim();
    })
    .then(() => {
      self.clients.matchAll({ includeUncontrolled: true, type: 'window' }).then(clients => {
        clients.forEach(client => {
          console.log('Сповіщення клієнта про оновлення кешу');
          client.postMessage({ type: 'CACHE_UPDATED', reload: true });
        });
      });
    })
  );
});

self.addEventListener('fetch', event => {
  const requestUrl = new URL(event.request.url);
  console.log(`Обробка запиту: ${requestUrl.href}`);

  // Обробка stations.json
  if (requestUrl.pathname.endsWith('stations.json')) {
    event.respondWith(
      fetch(event.request, { cache: 'no-store', headers: { 'Cache-Control': 'no-cache' } })
        .then(networkResponse => {
          console.log('Завантажено нову версію stations.json');
          return caches.open(CACHE_NAME).then(cache => {
            cache.put(event.request, networkResponse.clone());
            return networkResponse;
          });
        })
        .catch(() => {
          console.log('Повернення кешованої версії stations.json');
          return caches.match(event.request).then(cachedResponse => {
            return cachedResponse || new Response('Offline', { status: 503 });
          });
        })
    );
    return;
  }

  // Обробка зображень (favicon)
  if (requestUrl.pathname.match(/\.(png|jpg|jpeg|ico)$/)) {
    event.respondWith(
      fetch(event.request, { cache: 'no-store', headers: { 'Cache-Control': 'no-cache' } })
        .then(networkResponse => {
          return caches.open(CACHE_NAME).then(cache => {
            cache.put(event.request, networkResponse.clone());
            return networkResponse;
          });
        })
        .catch(() => {
          console.log(`Помилка завантаження зображення: ${requestUrl.href}`);
          return caches.match('/icon-192.png') || new Response('Image not available', { status: 404 });
        })
    );
    return;
  }

  // Обробка зовнішніх ресурсів
  if (!requestUrl.origin.includes(self.location.origin)) {
    event.respondWith(
      fetch(event.request)
        .catch(error => {
          console.error(`Помилка запиту до ${requestUrl.href}:`, error);
          return new Response('Network error', { status: 503 });
        })
    );
    return;
  }

  // Для інших ресурсів
  event.respondWith(
    fetch(event.request)
      .then(networkResponse => {
        if (event.request.method === 'GET') {
          return caches.open(CACHE_NAME).then(cache => {
            cache.put(event.request, networkResponse.clone());
            return networkResponse;
          });
        }
        return networkResponse;
      })
      .catch(() => {
        return caches.match(event.request).then(cachedResponse => {
          return cachedResponse || new Response('Offline', { status: 503 });
        });
      })
  );
});

self.addEventListener('message', event => {
  if (event.data.type === 'NETWORK_STATUS') {
    event.ports[0].postMessage({ online: navigator.onLine });
  }
});