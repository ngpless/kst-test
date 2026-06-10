// Service Worker для PWA — КСТ Тесты
const CACHE_NAME = 'kst-test-v1';
const STATIC_ASSETS = [
  '/',
  '/styles.css',
  '/favicon.ico',
  '/apple-touch-icon.png',
  '/icon-192x192.png',
  '/icon-512x512.png',
  '/logo.jpg',
  '/manifest.json'
];

// Установка — кэшируем статику
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(STATIC_ASSETS))
      .then(() => self.skipWaiting())
  );
});

// Активация — удаляем старые кэши
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((names) => Promise.all(
        names.filter((name) => name !== CACHE_NAME).map((name) => caches.delete(name))
      ))
      .then(() => self.clients.claim())
  );
});

// Стратегия: Network First для HTML и API, Cache First для статики
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // API запросы — всегда сеть, без кэша
  if (url.pathname.startsWith('/api/')) {
    return;
  }

  // HTML страницы — сеть, фоллбэк на кэш
  if (event.request.mode === 'navigate' || event.request.headers.get('accept')?.includes('text/html')) {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          return response;
        })
        .catch(() => caches.match(event.request))
    );
    return;
  }

  // Статика — кэш, фоллбэк на сеть
  event.respondWith(
    caches.match(event.request)
      .then((cached) => {
        if (cached) return cached;
        return fetch(event.request).then((response) => {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          return response;
        });
      })
  );
});
