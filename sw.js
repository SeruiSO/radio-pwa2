const CACHE_NAME = 'radio-pwa-cache-v93'; // Змінюємо версію кешу при кожному оновленні
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
    .then(() => {
      console.log('Активація нового Service Worker');
      return self.clients.claim();
    })
    .then(() => {
      // Повідомляємо клієнтам (відкритим вкладкам) про оновлення
      self.clients.matchAll({ includeUncontrolled: true, type: 'window' }).then(clients => {
        clients.forEach(client => {
          client.postMessage({ type: 'CACHE_UPDATED' });
        });
      });
    })
  );
});

self.addEventListener('fetch', event => {
  const requestUrl = new URL(event.request.url);
  console.log(`Обробка запиту: ${requestUrl.href}`);

  // Якщо запит стосується stations.json, завжди намагаємося отримати нову версію
  if (requestUrl.pathname.endsWith('stations.json')) {
    event.respondWith(
      fetch(event.request, { cache: 'no-store' }) // Обходимо кеш браузера
        .then(networkResponse => {
          // Оновлюємо кеш новою версією stations.json
          return caches.open(CACHE_NAME).then(cache => {
            cache.put(event.request, networkResponse.clone());
            return networkResponse;
          });
        })
        .catch(() => {
          // Якщо немає мережі, повертаємо кешовану версію
          return caches.match(event.request).then(cachedResponse => {
            return cachedResponse || new Response('Offline', { status: 503 });
          });
        })
    );
    return;
  }

  // Для всіх інших ресурсів використовуємо стратегію "спочатку мережа, потім кеш"
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