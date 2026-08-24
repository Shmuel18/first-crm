'use client';

import { useEffect } from 'react';

/** Re-check for a new service worker this often while the app stays open. The
 *  browser's own check can be as lazy as every 24h, which is how an office
 *  window ends up running week-old code. */
const UPDATE_INTERVAL_MS = 30 * 60 * 1000;

/**
 * Registers the service worker (public/sw.js) once, in production only — and
 * keeps long-lived windows on the CURRENT deployment.
 *
 * Why this exists: Vercel skew protection pins an open window's requests
 * (`?dpl=` tag) to the deployment it loaded from. That is right mid-session —
 * no half-old half-new pages — but an office window that is never fully
 * reloaded stays pinned for days: fixes deploy and the office keeps seeing the
 * old bugs. The refresh they're told to do is usually an in-app navigation,
 * which never breaks the pin.
 *
 * The heal path: sw.js updates are detected here (on return-to-app and every
 * 30 min), the new SW activates immediately (skipWaiting in sw.js), and the
 * `controllerchange` that fires marks this window stale. It then reloads at
 * the first safe moment — when hidden, so nobody loses in-progress typing —
 * and comes back on the new deployment. sw.js additionally reloads windows
 * that are already hidden at activation time.
 */
export function PwaRegister(): null {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production' || !('serviceWorker' in navigator)) return;

    let staleController = false;

    const reloadWhenSafe = () => {
      if (document.visibilityState === 'hidden') {
        window.location.reload();
      }
    };

    const onControllerChange = () => {
      // A new SW took over → a newer deployment exists. Never reload under the
      // user's hands; the hidden state is the safe moment.
      staleController = true;
      reloadWhenSafe();
    };

    const onVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        if (staleController) window.location.reload();
        return;
      }
      // Coming back to the app is the cheapest moment to look for an update.
      void navigator.serviceWorker.getRegistration().then((reg) => reg?.update());
    };

    const register = () => {
      navigator.serviceWorker.register('/sw.js').catch((err) => {
        console.error('[pwa] service worker registration failed', err);
      });
    };

    // Only fires on an ACTUAL controller swap — not on initial claim of an
    // uncontrolled page, per the guard below.
    let hadController = Boolean(navigator.serviceWorker.controller);
    const controllerListener = () => {
      if (!hadController) {
        hadController = true;
        return;
      }
      onControllerChange();
    };
    navigator.serviceWorker.addEventListener('controllerchange', controllerListener);
    document.addEventListener('visibilitychange', onVisibilityChange);
    const interval = window.setInterval(() => {
      void navigator.serviceWorker.getRegistration().then((reg) => reg?.update());
    }, UPDATE_INTERVAL_MS);

    // Register after load so it never competes with the initial render.
    if (document.readyState === 'complete') {
      register();
    } else {
      window.addEventListener('load', register, { once: true });
    }

    return () => {
      navigator.serviceWorker.removeEventListener('controllerchange', controllerListener);
      document.removeEventListener('visibilitychange', onVisibilityChange);
      window.clearInterval(interval);
      window.removeEventListener('load', register);
    };
  }, []);

  return null;
}
