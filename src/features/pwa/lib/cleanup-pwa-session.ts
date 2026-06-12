import { unsubscribePushAction } from '@/features/notifications/actions/unsubscribe-push';

/** Hard ceiling on the whole cleanup so logout never hangs on it. */
const CLEANUP_TIMEOUT_MS = 1500;

/**
 * Best-effort teardown of device-side PWA state at logout. On a shared/
 * handed-over device the previous user's home-screen badge and push
 * subscription would otherwise persist, leaking an ongoing activity signal
 * (R2-pwa-1). Scoped to THIS device only (the current PushManager
 * subscription) — other devices the user installed stay subscribed.
 *
 * Never throws AND never hangs: each step is guarded, and the whole thing is
 * raced against a short timeout. `navigator.serviceWorker.ready` in particular
 * is a promise that may NEVER resolve (no controlling SW yet), which would
 * otherwise stall the sign-out it precedes — so logout always proceeds within
 * CLEANUP_TIMEOUT_MS even if the SW or the unsubscribe round-trip is stuck.
 */
export async function cleanupPwaSession(): Promise<void> {
  await Promise.race([runCleanup(), sleep(CLEANUP_TIMEOUT_MS)]);
}

async function runCleanup(): Promise<void> {
  // Clear the app-icon badge (Badging API — installed PWAs on Chromium/iOS).
  try {
    await navigator.clearAppBadge?.();
  } catch {
    /* unsupported or denied — nothing to clear */
  }

  // Unsubscribe this device's push subscription (server row + browser object).
  try {
    const reg = await navigator.serviceWorker?.ready;
    const sub = await reg?.pushManager.getSubscription();
    if (sub) {
      await unsubscribePushAction(sub.endpoint);
      await sub.unsubscribe();
    }
  } catch {
    /* SW not ready / push unsupported — the server delete on the next
       device action or subscription expiry covers the long tail */
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
