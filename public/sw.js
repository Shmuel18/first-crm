/* Kaufman Finance — minimal PWA service worker.
 *
 * Installable + offline FALLBACK only. Deliberately caches NO application data:
 * cases / borrowers / financials / national-IDs never touch the device cache.
 * Only a static offline page + its icon are precached. Top-level navigations try
 * the network first and fall back to the offline page when offline; every other
 * request (data, assets, /api) goes straight to the network, uncached.
 *
 * Bump CACHE when PRECACHE changes so old shells are evicted on activate. */
const CACHE = 'kfg-shell-v4';
const OFFLINE_URL = '/offline.html';
// offline.js self-heals the fallback page (auto-retry + honest "connecting" vs
// "no connection" copy). It MUST be precached and served cache-first below —
// a network-only subresource would 404 on the very screen that has no network.
const PRECACHE = [OFFLINE_URL, '/offline.js', '/icons/icon-192.png'];

/* A single failed fetch is NOT proof that the device is offline. On an
 * installed iOS PWA every return to the app is a COLD START (iOS kills the
 * process aggressively and does not resume it), so the navigation fires while
 * the cellular radio is still waking — and rejects within milliseconds. iOS
 * also cancels in-flight requests when the app is backgrounded. Retrying a few
 * times turns most "no connection" screens back into a normal page load.
 * Navigations are GETs, so retrying is safe. Android/Chrome resumes from memory
 * far more often, which is why the same code only bites hard on iPhone. */
const RETRY_DELAYS_MS = [300, 800];

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function fetchWithRetry(request) {
  let lastError;
  for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt += 1) {
    try {
      return await fetch(request);
    } catch (err) {
      lastError = err;
      // The browser is certain there's no link — further attempts just burn
      // battery and delay the fallback. offline.js takes over the retrying.
      if (self.navigator.onLine === false) break;
      const delay = RETRY_DELAYS_MS[attempt];
      if (delay === undefined) break;
      await wait(delay);
    }
  }
  throw lastError;
}

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

  // The precached shell assets (offline page chrome) are served cache-first —
  // they are static, non-sensitive, and needed exactly when the network is
  // down. Scoped to PRECACHE only; nothing else is ever read from the cache.
  const path = new URL(req.url).pathname;
  if (req.mode !== 'navigate' && PRECACHE.includes(path)) {
    event.respondWith(caches.match(path).then((cached) => cached || fetch(req)));
    return;
  }

  // Only intercept top-level navigations: serve the offline page when the
  // network is unavailable. Everything else is pure network (no caching), so no
  // sensitive data is ever persisted on the device.
  if (req.mode === 'navigate') {
    event.respondWith(
      fetchWithRetry(req).catch(() =>
        // caches.match RESOLVES (not rejects) to undefined if the precache was
        // evicted under storage pressure — guard so we never respond with
        // undefined (which surfaces the browser's generic error page).
        caches
          .match(OFFLINE_URL)
          .then(
            (cached) =>
              cached ||
              fetch(OFFLINE_URL).catch(
                () =>
                  new Response('Offline', {
                    status: 503,
                    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
                  }),
              ),
          ),
      ),
    );
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
      // Direction follows the recipient's locale (dispatch route sets lang/dir);
      // Hebrew defaults keep older payloads rendering correctly.
      lang: data.lang || 'he',
      dir: data.dir || 'rtl',
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
