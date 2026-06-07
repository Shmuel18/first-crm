'use client';

import { useEffect } from 'react';

/**
 * Registers the service worker (public/sw.js) once, in production only. The SW
 * is install + offline-fallback only (it caches no app data — see sw.js). Render
 * once near the root; returns nothing.
 */
export function PwaRegister(): null {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production' || !('serviceWorker' in navigator)) return;
    const register = () => {
      navigator.serviceWorker.register('/sw.js').catch((err) => {
        console.error('[pwa] service worker registration failed', err);
      });
    };
    // Register after load so it never competes with the initial render.
    if (document.readyState === 'complete') {
      register();
      return;
    }
    window.addEventListener('load', register, { once: true });
    return () => window.removeEventListener('load', register);
  }, []);

  return null;
}
