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

/* Web Push (migration 150 + /api/push/dispatch). The payload is generic
 * (no PII). Showing the notification is also what makes the OS badge the app
 * icon on Android. */
self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = {};
  }
  const title = data.title || 'Kaufman';
  event.waitUntil(
    self.registration.showNotification(title, {
      body: data.body || '',
      icon: '/icons/icon-192.png',
      // Monochrome silhouette (transparent PNG) — Android masks the badge to a
      // white shape via its alpha channel. The full-colour icon-192 is opaque,
      // so it rendered as a solid white square in the status bar; badge-96 is a
      // transparent building glyph that masks to a clean white building.
      badge: '/icons/badge-96.png',
      lang: 'he',
      dir: 'rtl',
      tag: 'kfg-notification',
      renotify: true,
      data: { url: data.url || '/' },
    }),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || '/';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if ('focus' in client) {
          if ('navigate' in client) client.navigate(url);
          return client.focus();
        }
      }
      return self.clients.openWindow(url);
    }),
  );
});
