'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';

import { createClient } from '@/lib/supabase/server';

type Result = { ok: true } | { ok: false; error: 'unauthorized' | 'validation' | 'unknown' };

const idSchema = z.uuid();

export async function markNotificationReadAction(notificationId: string): Promise<Result> {
  const parsed = idSchema.safeParse(notificationId);
  if (!parsed.success) return { ok: false, error: 'validation' };

  const supabase = await createClient();
  const { data: userRes } = await supabase.auth.getUser();
  if (!userRes.user) return { ok: false, error: 'unauthorized' };

  // RLS already restricts to own rows; the user_id filter is belt-and-braces.
  const { error } = await supabase
    .from('notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('id', parsed.data)
    .eq('user_id', userRes.user.id)
    .is('read_at', null);

  if (error) return { ok: false, error: 'unknown' };

  revalidatePath('/', 'layout');
  return { ok: true };
}

export async function markAllNotificationsReadAction(): Promise<Result> {
  const supabase = await createClient();
  const { data: userRes } = await supabase.auth.getUser();
  if (!userRes.user) return { ok: false, error: 'unauthorized' };

  const { error } = await supabase
    .from('notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('user_id', userRes.user.id)
    .is('read_at', null);

  if (error) return { ok: false, error: 'unknown' };

  revalidatePath('/', 'layout');
  return { ok: true };
}
