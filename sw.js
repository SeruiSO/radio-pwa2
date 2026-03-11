const CACHE_NAME = 'radio-cache-v101';

// Слухаємо повідомлення від основного потоку
self.addEventListener('message', (event) => {
  if (event.data.type === 'METADATA') {
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
  self.skipWaiting();
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
      ]);
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
  if (url.includes('.mp3') || url.includes('.aac') || url.includes('.pls') || 
      url.includes('listen') || url.includes('stream') || url.includes('radio')) {
    
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
    // Додаємо заголовок для запиту метаданих
    const modifiedHeaders = new Headers(request.headers);
    modifiedHeaders.set('Icy-MetaData', '1');
    
    const modifiedRequest = new Request(request, {
      headers: modifiedHeaders
    });

    const response = await fetch(modifiedRequest);
    
    // Отримуємо інтервал метаданих з заголовків
    const icyMetaInt = response.headers.get('icy-metaint');
    
    if (!icyMetaInt) {
      // Якщо метадані не підтримуються, просто повертаємо потік
      return response;
    }

    const metaInt = parseInt(icyMetaInt, 10);
    
    // Створюємо новий потік з метаданими
    const { readable, writable } = new TransformStream();
    const reader = response.body.getReader();
    const writer = writable.getWriter();

    let buffer = new Uint8Array(0);
    let metadataBuffer = '';
    let stationUrl = request.url;

    // Функція для парсингу метаданих
    function parseMetadata(metadata) {
      const match = metadata.match(/StreamTitle='([^']*)'/);
      if (match && match[1]) {
        const track = match[1].trim();
        if (track) {
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
        }
      }
    }

    // Читаємо потік
    async function processStream() {
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          // Додаємо нові дані до буфера
          const newBuffer = new Uint8Array(buffer.length + value.length);
          newBuffer.set(buffer);
          newBuffer.set(value, buffer.length);
          buffer = newBuffer;

          // Обробляємо метадані
          while (buffer.length >= metaInt + 1) {
            // Аудіо-дані
            await writer.write(buffer.slice(0, metaInt));
            
            // Метадані
            const metaLen = buffer[metaInt] * 16;
            
            if (buffer.length >= metaInt + 1 + metaLen) {
              if (metaLen > 0) {
                const metadataBytes = buffer.slice(metaInt + 1, metaInt + 1 + metaLen);
                const metadataStr = new TextDecoder().decode(metadataBytes).replace(/\0/g, '');
                parseMetadata(metadataStr);
              }
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
        
        writer.close();
      } catch (error) {
        console.error('Stream processing error:', error);
        writer.abort(error);
      }
    }

    processStream();

    // Повертаємо новий потік без метаданих для аудіо-елемента
    return new Response(readable, {
      status: response.status,
      statusText: response.statusText,
      headers: {
        'Content-Type': response.headers.get('Content-Type') || 'audio/mpeg',
        'Access-Control-Allow-Origin': '*'
      }
    });

  } catch (error) {
    console.error('Audio request failed:', error);
    return fetch(request);
  }
}

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
  self.clients.matchAll().then((clients) => {
    clients.forEach((client) => {
      client.postMessage({ type: 'CACHE_UPDATED', cacheVersion: CACHE_NAME });
    });
  });
});