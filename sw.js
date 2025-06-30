const CACHE_NAME = 'vibewave-cache-v1';

self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME).then(cache => {
            return cache.addAll([
                '/',
                '/index.html',
                '/styles.css',
                '/script.js',
                '/stations.json',
                '/manifest.json'
            ]).then(() => {
                return caches.keys().then(cacheNames => {
                    return Promise.all(
                        cacheNames.map(cacheName => {
                            if (cacheName !== CACHE_NAME) {
                                return caches.delete(cacheName);
                            }
                        })
                    );
                });
            });
        })
    );
});

self.addEventListener('fetch', event => {
    event.respondWith(
        caches.match(event.request).then(response => {
            if (event.request.url.endsWith('stations.json')) {
                return fetch(event.request, { cache: 'no-store' }).then(networkResponse => {
                    caches.open(CACHE_NAME).then(cache => {
                        cache.put(event.request, networkResponse.clone());
                    });
                    return networkResponse;
                }).catch(() => caches.match('/index.html'));
            }
            return response || fetch(event.request).then(networkResponse => {
                return networkResponse;
            }).catch(() => caches.match('/index.html'));
        })
    );
});

self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames.map(cacheName => {
                    if (cacheName !== CACHE_NAME) {
                        return caches.delete(cacheName);
                    }
                })
            );
        })
    );
});

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
}, 2000);