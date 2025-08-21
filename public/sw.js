const CACHE_NAME = 'cinestream-v2';
const APP_SHELL = ['/index.html'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.map((k) => (k !== CACHE_NAME ? caches.delete(k) : undefined)))).then(
      () => self.clients.claim()
    )
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  const url = new URL(request.url);

  // SPA navigations: network-first, fallback to cached index.html
  if (request.mode === 'navigate') {
    event.respondWith(
      (async () => {
        try {
          return await fetch(request);
        } catch (_e) {
          const cache = await caches.open(CACHE_NAME);
          const cached = await cache.match('/index.html');
          return (
            cached ||
            new Response('<!doctype html><title>Offline</title><h1>Offline</h1>', {
              headers: { 'Content-Type': 'text/html' }
            })
          );
        }
      })()
    );
    return;
  }

  // Only handle same-origin GET requests for assets
  if (url.origin === self.location.origin && request.method === 'GET') {
    event.respondWith(
      (async () => {
        try {
          const res = await fetch(request);
          // Cache a clone (ignore failures silently)
          caches.open(CACHE_NAME).then((cache) => cache.put(request, res.clone())).catch(() => {});
          return res;
        } catch (_e) {
          const cache = await caches.open(CACHE_NAME);
          const cached = await cache.match(request);
          return cached || new Response('', { status: 504, statusText: 'Offline' });
        }
      })()
    );
  }
});


