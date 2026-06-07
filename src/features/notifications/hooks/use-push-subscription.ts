'use client';

import { useCallback, useEffect, useState } from 'react';

import { env } from '@/lib/env';

import { subscribePushAction } from '../actions/subscribe-push';
import { unsubscribePushAction } from '../actions/unsubscribe-push';

function detectSupport(): boolean {
  return (
    typeof navigator !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  );
}

/** VAPID public key (base64url) → the Uint8Array applicationServerKey expects.
 *  Returns a Uint8Array<ArrayBuffer> (not the default ArrayBufferLike) so it
 *  satisfies the BufferSource type pushManager.subscribe wants. */
function urlBase64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const normalized = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(normalized);
  const buffer = new ArrayBuffer(raw.length);
  const out = new Uint8Array(buffer);
  for (let i = 0; i < raw.length; i += 1) out[i] = raw.charCodeAt(i);
  return out;
}

type EnableResult = { ok: true } | { ok: false; reason: 'denied' | 'unsupported' | 'error' };

type PushSubscriptionState = {
  /** Client mount finished — gate UI on this to avoid SSR/hydration flor. */
  ready: boolean;
  /** Browser supports SW + Push + Notification. */
  supported: boolean;
  /** VAPID public key is configured (push is wired up at all). */
  configured: boolean;
  /** This device currently has an active push subscription. */
  subscribed: boolean;
  busy: boolean;
  enable: () => Promise<EnableResult>;
  disable: () => Promise<void>;
};

export function usePushSubscription(): PushSubscriptionState {
  const publicKey = env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const [supported] = useState(detectSupport);
  const [ready, setReady] = useState(false);
  const [subscribed, setSubscribed] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const run = async (): Promise<void> => {
      if (!supported) return;
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (!cancelled) setSubscribed(Boolean(sub));
    };
    // setState only in async callbacks (.then/.finally) — never synchronously in
    // the effect body — per the repo's react-hooks/set-state-in-effect rule.
    run()
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setReady(true);
      });
    return () => {
      cancelled = true;
    };
  }, [supported]);

  const enable = useCallback(async (): Promise<EnableResult> => {
    if (!supported || !publicKey) return { ok: false, reason: 'unsupported' };
    setBusy(true);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') return { ok: false, reason: 'denied' };
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey),
      });
      const json = sub.toJSON();
      const p256dh = json.keys?.p256dh;
      const auth = json.keys?.auth;
      if (!json.endpoint || !p256dh || !auth) {
        await sub.unsubscribe().catch(() => {});
        return { ok: false, reason: 'error' };
      }
      const res = await subscribePushAction({ endpoint: json.endpoint, p256dh, auth });
      if (!res.ok) {
        await sub.unsubscribe().catch(() => {});
        return { ok: false, reason: 'error' };
      }
      setSubscribed(true);
      return { ok: true };
    } catch {
      return { ok: false, reason: 'error' };
    } finally {
      setBusy(false);
    }
  }, [supported, publicKey]);

  const disable = useCallback(async (): Promise<void> => {
    setBusy(true);
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        const { endpoint } = sub;
        await sub.unsubscribe().catch(() => {});
        await unsubscribePushAction(endpoint);
      }
      setSubscribed(false);
    } finally {
      setBusy(false);
    }
  }, []);

  return {
    ready,
    supported,
    configured: Boolean(publicKey),
    subscribed,
    busy,
    enable,
    disable,
  };
}
