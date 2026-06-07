import 'server-only';

import webpush from 'web-push';

import { env } from '@/lib/env';

import {
  deletePushSubscriptionsByEndpoints,
  listUserPushSubscriptions,
} from './push-subscriptions.service';

/** Generic, NO-PII push payload. Title/body are category-level only; the user
 *  opens the app (RLS-protected) for the specifics. `url` is where a tap lands. */
export type PushPayload = { title: string; body: string; url: string };

let vapidReady = false;

function ensureVapid(): boolean {
  const subject = env.VAPID_SUBJECT;
  const publicKey = env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = env.VAPID_PRIVATE_KEY;
  if (!subject || !publicKey || !privateKey) return false;
  if (!vapidReady) {
    webpush.setVapidDetails(subject, publicKey, privateKey);
    vapidReady = true;
  }
  return true;
}

/**
 * Fan a single generic push out to all of a user's subscribed devices. Dead
 * endpoints (404/410 from the push service) are pruned. Never throws — push is
 * best-effort (the in-app bell is the source of truth). Node runtime only.
 */
export async function sendPushToUser(
  userId: string,
  payload: PushPayload,
): Promise<{ sent: number }> {
  if (!ensureVapid()) return { sent: 0 };
  const subs = await listUserPushSubscriptions(userId);
  if (subs.length === 0) return { sent: 0 };

  const body = JSON.stringify(payload);
  const dead: string[] = [];
  let sent = 0;

  await Promise.all(
    subs.map(async (s) => {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          body,
        );
        sent += 1;
      } catch (err) {
        const statusCode = (err as { statusCode?: number }).statusCode;
        // 404 / 410 = subscription gone (uninstalled / expired) → prune it.
        if (statusCode === 404 || statusCode === 410) dead.push(s.endpoint);
        else console.error('[push-sender] send failed', { statusCode: statusCode ?? null });
      }
    }),
  );

  if (dead.length > 0) await deletePushSubscriptionsByEndpoints(dead);
  return { sent };
}
