const CACHE_NAME = "radio-pwa-cache-v115";
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

// Резервний JSON для stations.json
const fallbackStations = {
  "techno": [
    { "value": "https://listen.technobase.fm/tunein-mp3", "name": "TechnoBase.FM", "genre": "Techno/Trance", "emoji": "🎶", "country": "Німеччина" }
  ],
  "trance": [],
  "ukraine": []
};

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
  const requestUrl = new URL(event.request.url);
  
  if (requestUrl.pathname.endsWith("stations.json")) {
    event.respondWith(
      fetch(event.request, { cache: "no-cache" })
        .then(response => {
          if (response && response.status === 200) {
            const responseToCache = response.clone();
            caches.open(CACHE_NAME).then(cache => {
              const headers = new Headers(responseToCache.headers);
              headers.set("Cache-Control", "max-age=86400");
              cache.put(event.request, new Response(responseToCache.body, {
                status: responseToCache.status,
                statusText: responseToCache.statusText,
                headers: headers
              }));
            });
            return response;
          }
          return caches.match(event.request).then(cachedResponse => {
            if (cachedResponse) return cachedResponse;
            return new Response(JSON.stringify(fallbackStations), {
              status: 200,
              headers: { "Content-Type": "application/json" }
            });
          });
        })
        .catch(() => {
          return caches.match(event.request).then(cachedResponse => {
            if (cachedResponse) return cachedResponse;
            return new Response(JSON.stringify(fallbackStations), {
              status: 200,
              headers: { "Content-Type": "application/json" }
            });
          });
        })
    );
  } else {
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
  }
});

self.addEventListener("activate", event => {
  const cacheWhitelist = [CACHE_NAME];
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (!cacheWhitelist.includes(cacheName)) {
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => {
      self.clients.matchAll().then(clients => {
        clients.forEach(client => {
          client.postMessage({ type: "UPDATE", message: "Додаток оновлено до нової версії!" });
        });
      });
    }).then(() => self.clients.claim())
  );
});

let wasOnline = navigator.onLine;

const checkNetworkStatus = () => {
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
};

self.addEventListener("online", () => {
  wasOnline = true;
  self.clients.matchAll().then(clients => {
    clients.forEach(client => {
      client.postMessage({ type: "NETWORK_STATUS", online: true });
    });
  });
});

self.addEventListener("offline", () => {
  wasOnline = false;
  self.clients.matchAll().then(clients => {
    clients.forEach(client => {
      client.postMessage({ type: "NETWORK_STATUS", online: false });
    });
  });
});

setInterval(checkNetworkStatus, 5000);

self.addEventListener("sync", event => {
  if (event.tag === "restore-stream") {
    event.waitUntil(
      checkNetworkStatus().then(() => {
        if (wasOnline) {
          self.clients.matchAll().then(clients => {
            clients.forEach(client => {
              client.postMessage({ type: "NETWORK_STATUS", online: true });
            });
          });
        }
      })
    );
  }
});