const CACHE_NAME = "radio-pwa-cache-v982";
const urlsToCache = [
  "/",
  "index.html",
  "styles.css",
  "script.js",
  "stations.json",
  "manifest.json",
  "icon-192.png",
  "icon-512.png"
];

self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE_NAME).catch(error => {
      console.error("Failed to open cache during install:", error);
      return caches.delete(CACHE_NAME).then(() => caches.open(CACHE_NAME));
    }).then(cache => {
      console.log("Caching files:", urlsToCache);
      return cache.addAll(urlsToCache).catch(error => {
        console.error("Caching error:", error);
        return Promise.resolve(); // Продовжуємо, навіть якщо кешування провалилося
      });
    }).then(() => self.skipWaiting())
  );
});

self.addEventListener("fetch", event => {
  const url = new URL(event.request.url);

  if (url.origin === "https://de1.api.radio-browser.info") {
    event.respondWith(
      fetch(event.request, { cache: "no-store", signal: AbortSignal.timeout(5000) })
        .then(response => {
          if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
          return response;
        })
        .catch(error => {
          console.error("API fetch error:", error);
          return Response.error();
        })
    );
  } else if (event.request.url.includes("stations.json")) {
    event.respondWith(
      caches.match(event.request).then(cachedResponse => {
        return fetch(event.request, { cache: "no-cache", signal: AbortSignal.timeout(5000) })
          .then(networkResponse => {
            if (networkResponse && networkResponse.status === 200) {
              const responseToCache = networkResponse.clone();
              caches.open(CACHE_NAME).catch(err => console.error("Cache open error:", err)).then(cache => {
                if (cache) cache.put(event.request, responseToCache);
              });
              return networkResponse;
            }
            return cachedResponse || Response.error();
          })
          .catch(() => cachedResponse || Response.error());
      })
    );
  } else {
    event.respondWith(
      caches.match(event.request).then(response => response || fetch(event.request).catch(() => Response.error()))
    );
  }
});

self.addEventListener("activate", event => {
  const cacheWhitelist = [CACHE_NAME];
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (!cacheWhitelist.includes(cacheName)) {
            console.log(`Deleting old cache: ${cacheName}`);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => {
      console.log("Activating new Service Worker");
      return self.clients.claim();
    }).catch(error => {
      console.error("Activation error:", error);
    })
  );
});

self.addEventListener("message", event => {
  if (event.data.type === "CHECK_NETWORK") {
    const isOnline = navigator.onLine || false;
    if (isOnline !== wasOnline) {
      wasOnline = isOnline;
      event.source.postMessage({ type: "NETWORK_STATUS", online: isOnline });
    }
  }
});

let wasOnline = navigator.onLine;

setInterval(() => {
  if (navigator.onLine !== wasOnline) {
    wasOnline = navigator.onLine;
    self.clients.matchAll().then(clients => {
      clients.forEach(client => {
        client.postMessage({ type: "NETWORK_STATUS", online: wasOnline });
      });
    });
  }
}, 1000);