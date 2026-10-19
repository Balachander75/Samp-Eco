// Navneet SAMP ERP Service Worker — High-Performance Static Asset Caching
const CACHE_NAME = "samp-static-v1";
const STATIC_ASSET_REGEX = /\/assets\/|\.(?:js|css|woff2?|png|jpg|jpeg|svg|ico)$/i;

self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      )
    ).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Bypass non-GET and API requests completely
  if (request.method !== "GET" || url.pathname.startsWith("/api/")) {
    return;
  }

  // Cache-First strategy for hashed static assets
  if (STATIC_ASSET_REGEX.test(url.pathname)) {
    event.respondWith(
      caches.match(request).then((cachedResponse) => {
        if (cachedResponse) {
          return cachedResponse;
        }
        return fetch(request).then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200 && networkResponse.type === "basic") {
            const responseToCache = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(request, responseToCache);
            });
          }
          return networkResponse;
        });
      })
    );
    return;
  }

  // Network-First strategy for navigation / HTML documents
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).catch(() => caches.match("/index.html"))
    );
  }
});
