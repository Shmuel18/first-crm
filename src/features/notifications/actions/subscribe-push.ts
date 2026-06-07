'use server';

import { headers } from 'next/headers';

import { z } from 'zod';

import { createClient } from '@/lib/supabase/server';

import { upsertPushSubscription } from '../services/push-subscriptions.service';

type Result = { ok: true } | { ok: false; error: 'unauthorized' | 'validation' | 'unknown' };

const schema = z.object({
  endpoint: z.string().url(),
  p256dh: z.string().min(1),
  auth: z.string().min(1),
});

/**
 * Store (or refresh) the current device's Web Push subscription for the signed-in
 * user. Called by usePushSubscription after the browser grants permission +
 * subscribes via PushManager.
 */
export async function subscribePushAction(input: {
  endpoint: string;
  p256dh: string;
  auth: string;
}): Promise<Result> {
  const parsed = schema.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'validation' };

  const supabase = await createClient();
  const { data: userRes } = await supabase.auth.getUser();
  if (!userRes.user) return { ok: false, error: 'unauthorized' };

  const userAgent = (await headers()).get('user-agent');
  const ok = await upsertPushSubscription(userRes.user.id, parsed.data, userAgent);
  return ok ? { ok: true } : { ok: false, error: 'unknown' };
}
