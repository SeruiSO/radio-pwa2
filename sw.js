const CACHE_NAME = "radio-pwa-cache-v808"; // Оновлено версію кешу
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

// Змінна для відстеження першого запиту до stations.json у сесії
let isInitialLoad = true;

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
  if (event.request.url.includes("stations.json")) {
    if (isInitialLoad) {
      // При першому запиті обходимо кеш і йдемо в мережу
      event.respondWith(
        fetch(event.request, { cache: "no-cache" })
          .then(networkResponse => {
            if (!networkResponse || networkResponse.status !== 200) {
              // Якщо мережевий запит не вдався, повертаємо кеш
              return caches.match(event.request) || Response.error();
            }
            // Оновлюємо кеш і позначаємо, що початкове завантаження завершено
            const responseToCache = networkResponse.clone();
            caches.open(CACHE_NAME).then(cache => {
              cache.put(event.request, responseToCache);
            });
            isInitialLoad = false; // Далі в цій сесії використовуємо кеш
            return networkResponse;
          })
          .catch(() => caches.match(event.request) || Response.error())
      );
    } else {
      // Для наступних запитів використовуємо кеш із можливістю оновлення
      event.respondWith(
        caches.match(event.request)
          .then(cachedResponse => {
            const fetchPromise = fetch(event.request, { cache: "no-cache" })
              .then(networkResponse => {
                if (networkResponse && networkResponse.status === 200) {
                  const responseToCache = networkResponse.clone();
                  caches.open(CACHE_NAME).then(cache => {
                    cache.put(event.request, responseToCache);
                  });
                  return networkResponse;
                }
                return cachedResponse || Response.error();
              })
              .catch(() => cachedResponse || Response.error());
            return cachedResponse || fetchPromise;
          })
      );
    }
  } else {
    // Для інших ресурсів використовуємо стандартну стратегію кешування
    event.respondWith(
      caches.match(event.request)
        .then(response => response || fetch(event.request))
        .catch(() => caches.match(event.request))
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
            console.log(`Видалення старого кешу: ${cacheName}`);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => {
      console.log("Активація нового Service Worker");
      isInitialLoad = true; // Скидаємо для нової сесії
      self.clients.matchAll().then(clients => {
        clients.forEach(client => {
          client.postMessage({ type: "UPDATE", message: "Додаток оновлено до нової версії!" });
        });
      });
    }).then(() => self.clients.claim())
  );
});

// Моніторинг стану мережі та Bluetooth
let wasOnline = navigator.onLine;
let isBluetoothConnected = false; // Додано для відстеження стану Bluetooth
let retryAttempts = { 1: 0, 2: 0, 5: 0 }; // Додано для повторних спроб
let retryInterval = null; // Додано для інтервалу повторних спроб

function startNetworkCheck(interval) {
  if (retryInterval) clearInterval(retryInterval);
  retryAttempts[interval]++;
  retryInterval = setInterval(() => {
    fetch("https://www.google.com", { method: "HEAD", mode: "no-cors" })
      .then(() => {
        if (!wasOnline) {
          wasOnline = true;
          self.clients.matchAll().then(clients => {
            clients.forEach(client => {
              client.postMessage({ type: "NETWORK_STATUS", online: true });
              client.postMessage({ type: "BLUETOOTH_RECONNECT" });
            });
            if (!clients.length) {
              self.registration.showNotification("", { tag: "network-reconnect", silent: true });
            }
          });
          clearInterval(retryInterval);
          retryAttempts = { 1: 0, 2: 0, 5: 0 };
        }
      })
      .catch(() => {
        if (retryAttempts[1] < 10) {
          if (interval !== 1) startNetworkCheck(1);
        } else if (retryAttempts[2] < 10) {
          if (interval !== 2) startNetworkCheck(2);
        } else if (retryAttempts[5] < 10) {
          if (interval !== 5) startNetworkCheck(5);
        } else {
          clearInterval(retryInterval);
          retryAttempts = { 1: 0, 2: 0, 5: 0 };
        }
      });
  }, interval * 1000);
}

self.addEventListener("message", event => {
  if (event.data.type === "BLUETOOTH_STATUS") { // Додано обробку BLUETOOTH_STATUS
    isBluetoothConnected = event.data.connected;
    console.log(`Bluetooth status updated: ${isBluetoothConnected}`);
    if (isBluetoothConnected) {
      self.clients.matchAll().then(clients => {
        clients.forEach(client => {
          client.postMessage({ type: "BLUETOOTH_RECONNECT" });
        });
        if (!clients.length) {
          self.registration.showNotification("", { tag: "bluetooth-reconnect", silent: true });
        }
      });
    }
  } else if (event.data.type === "REQUEST_RESTART") { // Додано обробку REQUEST_RESTART
    console.log(`Отримано запит на повторне підключення: ${event.data.reason}`);
    startNetworkCheck(1);
  }
});

// Початкова перевірка мережі
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
}, 1000);