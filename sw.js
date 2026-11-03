const CACHE = 'ripple-room-v2.1.0';
const ASSETS = [
  './',
  './index.html',
  './styles.css',
  './studio.css',
  './living.css',
  './living.js',
  './living-engine.js',
  './app.js',
  './engine.js',
  './data.js',
  './db.js',
  './cloud.js',
  './config.js',
  './icon.svg',
  './icon-180.png',
  './icon-192.png',
  './icon-512.png',
  './manifest.webmanifest',
  './vendor/supabase.js',
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
    fetch(e.request)
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
