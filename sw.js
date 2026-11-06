const CACHE = 'ripple-room-v2.2.1';
const ASSETS = [
  './',
  './index.html',
  './styles.css?v=2.2.1',
  './studio.css?v=2.2.1',
  './living.css?v=2.2.1',
  './living.js?v=2.2.1',
  './living-engine.js?v=2.2.1',
  './app.js?v=2.2.1',
  './engine.js?v=2.2.1',
  './data.js?v=2.2.1',
  './db.js?v=2.2.1',
  './cloud.js?v=2.2.1',
  './config.js?v=2.2.1',
  './icon.svg',
  './icon-180.png',
  './icon-192.png',
  './icon-512.png',
  './manifest.webmanifest',
  './vendor/supabase.js?v=2.2.1',
  './fonts/type-713ca32c3c.woff2',
  './fonts/type-1a551706a8.woff2',
];
self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)));
  self.skipWaiting();
});
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((k) => k.startsWith('ripple-room-') && k !== CACHE)
            .map((k) => caches.delete(k)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});
self.addEventListener('fetch', (e) => {
  const u = new URL(e.request.url);
  if (e.request.method !== 'GET' || u.origin !== self.location.origin) return;
  e.respondWith(
    fetch(e.request, { cache: 'no-cache' })
      .then((r) => {
        if (r.ok) {
          const copy = r.clone();
          caches.open(CACHE).then((c) => c.put(e.request, copy));
        }
        return r;
      })
      .catch(() =>
        caches
          .match(e.request)
          .then(
            (r) =>
              r ||
              (e.request.mode === 'navigate'
                ? caches.match('./index.html')
                : Response.error()),
          ),
      ),
  );
});
