/* Kaufman Finance — minimal PWA service worker.
 *
 * Installable + offline FALLBACK only. Deliberately caches NO application data:
 * cases / borrowers / financials / national-IDs never touch the device cache.
 * Only a static offline page + its icon are precached. Top-level navigations try
 * the network first and fall back to the offline page when offline; every other
 * request (data, assets, /api) goes straight to the network, uncached.
 *
 * Bump CACHE when PRECACHE changes so old shells are evicted on activate. */
const CACHE = 'kfg-shell-v1';
const OFFLINE_URL = '/offline.html';
const PRECACHE = [OFFLINE_URL, '/icons/icon-192.png'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((c) => c.addAll(PRECACHE))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  // Only intercept top-level navigations: serve the offline page when the
  // network is unavailable. Everything else is pure network (no caching), so no
  // sensitive data is ever persisted on the device.
  if (req.mode === 'navigate') {
    event.respondWith(fetch(req).catch(() => caches.match(OFFLINE_URL)));
  }
});
