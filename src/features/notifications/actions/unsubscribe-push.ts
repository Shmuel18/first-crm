'use server';

import { z } from 'zod';

import { createClient } from '@/lib/supabase/server';

import { deletePushSubscriptionByEndpoint } from '../services/push-subscriptions.service';

type Result = { ok: true } | { ok: false; error: 'unauthorized' | 'validation' };

const schema = z.object({ endpoint: z.string().url() });

/**
 * Remove the current device's Web Push subscription. Called by
 * usePushSubscription when the user turns notifications off (after the browser
 * unsubscribes the PushManager).
 */
export async function unsubscribePushAction(endpoint: string): Promise<Result> {
  const parsed = schema.safeParse({ endpoint });
  if (!parsed.success) return { ok: false, error: 'validation' };

  const supabase = await createClient();
  const { data: userRes } = await supabase.auth.getUser();
  if (!userRes.user) return { ok: false, error: 'unauthorized' };

  await deletePushSubscriptionByEndpoint(parsed.data.endpoint);
  return { ok: true };
}
