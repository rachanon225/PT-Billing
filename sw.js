// Minimal service worker — no offline caching, just satisfies Chrome/Android's
// PWA installability check (which wants a registered SW with a fetch handler).
self.addEventListener('fetch', function (event) {
  event.respondWith(fetch(event.request));
});
