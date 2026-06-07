'use client';

import { useCallback, useSyncExternalStore } from 'react';

/**
 * The non-standard `beforeinstallprompt` event (Chromium). Typed locally since
 * it isn't in lib.dom yet. iOS Safari never fires it — there we fall back to
 * manual "Share → Add to Home Screen" instructions.
 */
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

// Module-level external store. Read SSR-safely via useSyncExternalStore so there
// is no setState-in-effect and no hydration mismatch (the server snapshot is a
// neutral "not ready", then React re-reads on the client).
let deferredPrompt: BeforeInstallPromptEvent | null = null;
let installed = false;
let started = false;
const subscribers = new Set<() => void>();

function notify(): void {
  subscribers.forEach((cb) => cb());
}

function startListening(): void {
  if (started || typeof window === 'undefined') return;
  started = true;
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    // Only the Chromium beforeinstallprompt event reaches this listener.
    deferredPrompt = e as BeforeInstallPromptEvent;
    notify();
  });
  window.addEventListener('appinstalled', () => {
    deferredPrompt = null;
    installed = true;
    notify();
  });
}

function subscribe(cb: () => void): () => void {
  startListening();
  subscribers.add(cb);
  return () => {
    subscribers.delete(cb);
  };
}

function isStandaloneNow(): boolean {
  const nav = window.navigator as Navigator & { standalone?: boolean };
  return (
    installed ||
    window.matchMedia('(display-mode: standalone)').matches ||
    nav.standalone === true
  );
}

function isIOSNow(): boolean {
  const ua = window.navigator.userAgent;
  // iPhone/iPad/iPod, plus iPadOS which reports as Mac with touch.
  return /iphone|ipad|ipod/i.test(ua) || (/Mac/.test(ua) && window.navigator.maxTouchPoints > 1);
}

/**
 * Snapshot encodes [ready, canPrompt, standalone, iOS] as a stable string so
 * useSyncExternalStore can compare cheaply (Object.is on equal strings is true,
 * so no render loop). Leading "1" = client-resolved; the server snapshot is all
 * zeros, which keeps install affordances hidden until after hydration.
 */
function getSnapshot(): string {
  return `1${deferredPrompt ? 1 : 0}${isStandaloneNow() ? 1 : 0}${isIOSNow() ? 1 : 0}`;
}

function getServerSnapshot(): string {
  return '0000';
}

type PwaInstall = {
  ready: boolean;
  canPrompt: boolean;
  isStandalone: boolean;
  isIOS: boolean;
  promptInstall: () => Promise<boolean>;
};

export function usePwaInstall(): PwaInstall {
  const snap = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const promptInstall = useCallback(async (): Promise<boolean> => {
    if (!deferredPrompt) return false;
    await deferredPrompt.prompt();
    const choice = await deferredPrompt.userChoice;
    deferredPrompt = null;
    notify();
    return choice.outcome === 'accepted';
  }, []);

  return {
    ready: snap[0] === '1',
    canPrompt: snap[1] === '1',
    isStandalone: snap[2] === '1',
    isIOS: snap[3] === '1',
    promptInstall,
  };
}
