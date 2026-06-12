import { unsubscribePushAction } from '@/features/notifications/actions/unsubscribe-push';

/**
 * Best-effort teardown of device-side PWA state at logout. On a shared/
 * handed-over device the previous user's home-screen badge and push
 * subscription would otherwise persist, leaking an ongoing activity signal
 * (R2-pwa-1). Scoped to THIS device only (the current PushManager
 * subscription) — other devices the user installed stay subscribed.
 *
 * Never throws: every step is independently guarded so a cleanup hiccup can
 * never block the sign-out it precedes.
 */
export async function cleanupPwaSession(): Promise<void> {
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
