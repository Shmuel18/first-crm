import type { SupabaseClient } from '@supabase/supabase-js';

import { createAdminClient } from '@/lib/supabase/admin';

/**
 * Data access for push_subscriptions (migration 150). Service-role admin client
 * only — the table is RLS-locked with no policy, so all reads/writes go through
 * here, after the caller has verified auth (actions) or the shared secret
 * (dispatch route). The table isn't in the generated Database types yet, so it's
 * reached via an untyped client view.
 */
export type StoredPushSubscription = {
  endpoint: string;
  p256dh: string;
  auth: string;
};

function table() {
  return (createAdminClient() as unknown as SupabaseClient).from('push_subscriptions');
}

export async function upsertPushSubscription(
  userId: string,
  sub: StoredPushSubscription,
  userAgent: string | null,
): Promise<boolean> {
  const { error } = await table().upsert(
    {
      user_id: userId,
      endpoint: sub.endpoint,
      p256dh: sub.p256dh,
      auth: sub.auth,
      user_agent: userAgent,
      last_seen_at: new Date().toISOString(),
    },
    { onConflict: 'endpoint' },
  );
  if (error) {
    console.error('[push-subscriptions] upsert failed', { code: error.code });
    return false;
  }
  return true;
}

export async function deletePushSubscriptionByEndpoint(endpoint: string): Promise<void> {
  const { error } = await table().delete().eq('endpoint', endpoint);
  if (error) console.error('[push-subscriptions] delete failed', { code: error.code });
}

export async function listUserPushSubscriptions(
  userId: string,
): Promise<StoredPushSubscription[]> {
  const { data, error } = await table()
    .select('endpoint, p256dh, auth')
    .eq('user_id', userId);
  if (error) {
    console.error('[push-subscriptions] list failed', { code: error.code });
    return [];
  }
  return (data ?? []) as StoredPushSubscription[];
}

/** Prune subscriptions the push service reported as gone (404/410). */
export async function deletePushSubscriptionsByEndpoints(endpoints: string[]): Promise<void> {
  if (endpoints.length === 0) return;
  const { error } = await table().delete().in('endpoint', endpoints);
  if (error) console.error('[push-subscriptions] prune failed', { code: error.code });
}
