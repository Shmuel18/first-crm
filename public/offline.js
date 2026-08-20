/* Kaufman Finance — self-healing logic for offline.html.
 *
 * External (not inline) on purpose: the CSP is `script-src 'self' 'unsafe-inline'`
 * today, but layout.tsx tracks dropping 'unsafe-inline' — an external same-origin
 * file keeps working after that. Precached by sw.js and served cache-first, so it
 * is available with no network at all.
 *
 * Two jobs:
 *  1. Pick the honest state. A failed request does NOT mean "no internet" — on an
 *     installed iOS PWA the usual cause is a cold start firing before the cellular
 *     radio is up. `navigator.onLine === true` therefore renders "connecting",
 *     not "no connection".
 *  2. Recover without the user. Poll a tiny static asset and reload the moment it
 *     answers, so the screen disappears by itself instead of waiting for a tap. */
(function () {
  'use strict';

  // /manifest.webmanifest is static, tiny, and excluded from the auth proxy
  // matcher (src/proxy.ts) — a probe costs no Supabase round-trip.
  var PROBE_URL = '/manifest.webmanifest';
  var FAST_INTERVAL_MS = 2000;
  var SLOW_INTERVAL_MS = 6000;
  // Back off after ~15s of failures so a phone left on this screen in a basement
  // isn't kept awake polling every two seconds.
  var FAST_ATTEMPTS = 7;

  var attempts = 0;
  var timer = null;
  var probing = false;

  function render(state) {
    document.body.setAttribute('data-state', state);
  }

  function schedule() {
    if (timer) clearTimeout(timer);
    timer = setTimeout(probe, attempts < FAST_ATTEMPTS ? FAST_INTERVAL_MS : SLOW_INTERVAL_MS);
  }

  function probe() {
    if (probing) return;
    // The browser already knows it's offline — don't burn a request or wake the
    // radio; the 'online' event below will drive the retry.
    if (navigator.onLine === false) {
      render('offline');
      schedule();
      return;
    }
    probing = true;
    attempts += 1;
    fetch(PROBE_URL + '?ping=' + Date.now(), { method: 'HEAD', cache: 'no-store' })
      .then(function () {
        // Network is back. Reload re-requests the ORIGINAL url (the SW served this
        // page in place at e.g. /cases/123), so the user lands where they meant to.
        window.location.reload();
      })
      .catch(function () {
        probing = false;
        render(navigator.onLine === false ? 'offline' : 'connecting');
        schedule();
      });
  }

  function retryNow() {
    attempts = 0;
    probing = false;
    render('connecting');
    probe();
  }

  render(navigator.onLine === false ? 'offline' : 'connecting');

  window.addEventListener('online', retryNow);
  window.addEventListener('offline', function () {
    render('offline');
  });
  // Returning to a backgrounded PWA is the most likely moment for the radio to
  // have come back; probe immediately rather than waiting out the timer.
  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'visible') retryNow();
  });

  schedule();
})();
