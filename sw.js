const CACHE_NAME = "radio-pwa-cache-v149";
const urlsToCache = [
  "/",
  "index.html",
  "styles.css",
  "script.js",
  "stations.json",
  "manifest.json",
  "icon-192.png",
  "icon-512.png",
  "icon-maskable-192.png",
  "icon-monochrome-192.png",
  "screenshot-1.png",
  "screenshot-2.png"
];

self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log("Кешування файлів:", urlsToCache);
        return cache.addAll(urlsToCache).catch(error => {
          console.error("Помилка кешування:", error);
        });
      })
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("fetch", event => {
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        if (response) {
          return response;
        }
        return fetch(event.request).then(response => {
          if (!response || response.status !== 200 || response.type !== "basic") {
            return response;
          }
          const responseToCache = response.clone();
          caches.open(CACHE_NAME)
            .then(cache => {
              cache.put(event.request, responseToCache);
            });
          return response;
        }).catch(() => {
          return caches.match(event.request);
        });
      })
  );
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Фонова синхронізація
self.addEventListener("sync", event => {
  if (event.tag === "background-sync") {
    event.waitUntil(
      caches.open(CACHE_NAME).then(cache => {
        return fetch("stations.json", { cache: "no-cache" })
          .then(response => response.json())
          .then(data => {
            const updatedCache = new Response(JSON.stringify(data));
            return cache.put("stations.json", updatedCache);
          })
          .catch(error => console.error("Помилка синхронізації:", error))
      })
    );
  }
});

// Періодична синхронізація
self.addEventListener("periodicsync", event => {
  if (event.tag === "periodic-sync") {
    event.waitUntil(
      caches.open(CACHE_NAME).then(cache => {
        return fetch("stations.json", { cache: "no-cache" })
          .then(response => response.json())
          .then(data => {
            const updatedCache = new Response(JSON.stringify(data));
            return cache.put("stations.json", updatedCache);
          })
          .catch(error => console.error("Помилка періодичної синхронізації:", error))
      })
    );
  }
});

// Моніторинг стану мережі
let wasOnline = navigator.onLine;

setInterval(() => {
  fetch("https://www.google.com", { method: "HEAD", mode: "no-cors" })
    .then(() => {
      if (!wasOnline) {
        wasOnline = true;
        self.clients.matchAll().then(clients => {
          clients.forEach(client => {
            client.postMessage({ type: "NETWORK_STATUS", online: true });
          });
        });
      }
    })
    .catch(() => {
      if (wasOnline) {
        wasOnline = false;
        self.clients.matchAll().then(clients => {
          clients.forEach(client => {
            client.postMessage({ type: "NETWORK_STATUS", online: false });
          });
        });
      }
    });
}, 1000);