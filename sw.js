const CACHE_NAME = 'radio-cache-v103';

// Список аудіо-розширень та патернів
const AUDIO_PATTERNS = [
  '.mp3', '.aac', '.ogg', '.m3u', '.pls', '.m3u8',
  '/stream', '/listen', '/live', '/radio',
  'stream', 'listen', 'live', 'radio',
  'hitfm', 'kissfm', 'lux', 'roks', 'djfm'
];

// Допоміжна функція для визначення аудіо-запитів
function isAudioRequest(url) {
  const urlLower = url.toLowerCase();
  // Перевіряємо за розширеннями та патернами
  return AUDIO_PATTERNS.some(pattern => urlLower.includes(pattern));
}

// Слухаємо повідомлення від основного потоку
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'METADATA') {
    console.log('SW: Received METADATA message:', event.data);
    // Пересилаємо метадані всім відкритим вкладкам
    self.clients.matchAll().then(clients => {
      clients.forEach(client => {
        client.postMessage({
          type: 'METADATA_UPDATE',
          track: event.data.track,
          stationUrl: event.data.stationUrl
        });
      });
    });
  }
});

self.addEventListener('install', (event) => {
  console.log('SW: Installing version', CACHE_NAME);
  self.skipWaiting(); // Активуємо одразу
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
      ]).catch(err => console.log('SW: Cache addAll error:', err));
    })
  );
});

self.addEventListener('fetch', (event) => {
  const url = event.request.url;
  
  // Пропускаємо API запити
  if (url.includes('api.radio-browser.info')) {
    event.respondWith(
      fetch(event.request)
        .then(response => response)
        .catch(() => new Response(JSON.stringify({ error: 'Network error' }), {
          status: 503,
          headers: { 'Content-Type': 'application/json' }
        }))
    );
    return;
  }

  // Для аудіо-потоків – перехоплюємо і додаємо метадані
  if (isAudioRequest(url)) {
    console.log('SW: Intercepting audio request:', url);
    event.respondWith(handleAudioRequest(event.request));
    return;
  }

  // Для всього іншого – кеш/мережа
  event.respondWith(
    caches.match(event.request).then((response) => {
      if (event.request.url.endsWith('stations.json')) {
        return fetch(event.request, { cache: 'no-store' }).then((networkResponse) => {
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, networkResponse.clone());
          });
          return networkResponse;
        }).catch(() => caches.match('/index.html'));
      }
      return response || fetch(event.request).catch(() => caches.match('/index.html'));
    })
  );
});

// Обробка аудіо-запитів з метаданими
async function handleAudioRequest(request) {
  try {
    console.log('SW: Handling audio request for:', request.url);
    
    // Додаємо заголовок для запиту метаданих
    const headers = new Headers(request.headers);
    headers.set('Icy-MetaData', '1');
    headers.set('User-Agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36');
    
    const modifiedRequest = new Request(request, {
      headers: headers,
      mode: 'cors',
      credentials: 'omit'
    });

    console.log('SW: Fetching with Icy-MetaData header');
    const response = await fetch(modifiedRequest);
    
    if (!response.ok) {
      console.log('SW: Response not OK, returning original');
      return response;
    }

    // Отримуємо інтервал метаданих з заголовків
    const icyMetaInt = response.headers.get('icy-metaint');
    console.log('SW: icy-metaint =', icyMetaInt);
    
    if (!icyMetaInt) {
      console.log('SW: No icy-metaint, returning original response');
      return response;
    }

    const metaInt = parseInt(icyMetaInt, 10);
    if (isNaN(metaInt) || metaInt <= 0) {
      console.log('SW: Invalid metaInt, returning original');
      return response;
    }

    // Отримуємо оригінальні заголовки для відповіді
    const responseHeaders = new Headers(response.headers);
    // Видаляємо заголовки, які можуть заважати
    responseHeaders.delete('content-length');
    responseHeaders.set('Access-Control-Allow-Origin', '*');
    responseHeaders.set('Cache-Control', 'no-cache');

    // Створюємо новий потік з метаданими
    const { readable, writable } = new TransformStream();
    const reader = response.body.getReader();
    const writer = writable.getWriter();

    let buffer = new Uint8Array(0);
    let metadataBuffer = '';
    let stationUrl = request.url;

    // Функція для парсингу метаданих
    function parseMetadata(metadata) {
      console.log('SW: Raw metadata:', metadata);
      // Шукаємо StreamTitle в різних форматах
      const patterns = [
        /StreamTitle='([^']*)'/,
        /StreamTitle="([^"]*)"/,
        /StreamTitle=([^;]+)/,
        /title='([^']*)'/i,
        /title="([^"]*)"/i,
        /CurrentTrack='([^']*)'/i,
        /CurrentTrack="([^"]*)"/i,
        /NowPlaying='([^']*)'/i,
        /NowPlaying="([^"]*)"/i
      ];
      
      for (const pattern of patterns) {
        const match = metadata.match(pattern);
        if (match && match[1]) {
          const track = match[1].trim();
          if (track && track !== '' && track !== 'undefined' && track !== 'null') {
            console.log('SW: Found track:', track);
            // Відправляємо метадані в основний потік
            self.clients.matchAll().then(clients => {
              clients.forEach(client => {
                client.postMessage({
                  type: 'METADATA_UPDATE',
                  track: track,
                  stationUrl: stationUrl
                });
              });
            });
            return true;
          }
        }
      }
      return false;
    }

    // Читаємо потік
    async function processStream() {
      try {
        let bytesProcessed = 0;
        let metadataCount = 0;
        
        console.log('SW: Starting stream processing with metaInt:', metaInt);
        
        while (true) {
          const { done, value } = await reader.read();
          if (done) {
            console.log('SW: Stream ended, total bytes:', bytesProcessed, 'metadata blocks:', metadataCount);
            break;
          }

          // Додаємо нові дані до буфера
          const newBuffer = new Uint8Array(buffer.length + value.length);
          newBuffer.set(buffer);
          newBuffer.set(value, buffer.length);
          buffer = newBuffer;

          // Обробляємо метадані
          while (buffer.length >= metaInt + 1) {
            // Записуємо аудіо-дані
            await writer.write(buffer.slice(0, metaInt));
            bytesProcessed += metaInt;
            
            // Читаємо довжину метаданих
            const metaLen = buffer[metaInt] * 16;
            
            if (buffer.length >= metaInt + 1 + metaLen) {
              if (metaLen > 0) {
                const metadataBytes = buffer.slice(metaInt + 1, metaInt + 1 + metaLen);
                const metadataStr = new TextDecoder().decode(metadataBytes).replace(/\0/g, '');
                metadataCount++;
                parseMetadata(metadataStr);
              }
              // Видаляємо оброблені дані
              buffer = buffer.slice(metaInt + 1 + metaLen);
            } else {
              break;
            }
          }
        }
        
        // Записуємо залишок
        if (buffer.length > 0) {
          await writer.write(buffer);
        }
        
        await writer.close();
        console.log('SW: Stream processing complete');
      } catch (error) {
        console.error('SW: Stream processing error:', error);
        try {
          await writer.abort(error);
        } catch (e) {}
      }
    }

    processStream();

    // Повертаємо новий потік
    return new Response(readable, {
      status: response.status,
      statusText: response.statusText,
      headers: responseHeaders
    });

  } catch (error) {
    console.error('SW: Audio request failed:', error);
    // У випадку помилки пробуємо звичайний запит
    return fetch(request);
  }
}

self.addEventListener('activate', (event) => {
  console.log('SW: Activating version', CACHE_NAME);
  event.waitUntil(
    Promise.all([
      caches.keys().then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            if (cacheName !== CACHE_NAME) {
              console.log('SW: Deleting old cache', cacheName);
              return caches.delete(cacheName);
            }
          })
        );
      }),
      self.clients.claim() // Починаємо контролювати клієнтів одразу
    ])
  );
  
  // Повідомляємо про оновлення кешу
  self.clients.matchAll().then((clients) => {
    clients.forEach((client) => {
      client.postMessage({ 
        type: 'CACHE_UPDATED', 
        cacheVersion: CACHE_NAME 
      });
    });
  });
});

// Моніторинг стану мережі
let wasOnline = self.navigator ? self.navigator.onLine : true;
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

if (self.navigator && !self.navigator.onLine && wasOnline) {
  wasOnline = false;
  startNetworkCheck();
}