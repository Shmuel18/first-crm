import type { SupabaseClient } from '@supabase/supabase-js';

import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';

import {
  DEFAULT_NOTIFICATION_PREFERENCES,
  type NotificationPreferences,
  type NotificationType,
} from '../types';

// notification_preferences (migration 036) isn't in the generated Database types
// yet, so it's reached through an untyped client view. RLS restricts rows to the
// owner; the email gate below reads other users' rows via the service-role client.
function prefsTable(client: SupabaseClient | ReturnType<typeof createAdminClient>) {
  return (client as unknown as SupabaseClient).from('notification_preferences');
}

export async function getMyNotificationPreferences(): Promise<NotificationPreferences> {
  const supabase = await createClient();
  const { data: userRes } = await supabase.auth.getUser();
  if (!userRes.user) return DEFAULT_NOTIFICATION_PREFERENCES;

  const { data } = await prefsTable(supabase)
    .select('email_task_assigned, email_task_completed')
    .eq('user_id', userRes.user.id)
    .maybeSingle();
  if (!data) return DEFAULT_NOTIFICATION_PREFERENCES;

  return {
    email_task_assigned: data.email_task_assigned !== false,
    email_task_completed: data.email_task_completed !== false,
  };
}

export async function updateMyNotificationPreferences(
  prefs: NotificationPreferences,
): Promise<boolean> {
  const supabase = await createClient();
  const { data: userRes } = await supabase.auth.getUser();
  if (!userRes.user) return false;

  const { error } = await prefsTable(supabase)
    .upsert({ user_id: userRes.user.id, ...prefs }, { onConflict: 'user_id' })
    .select('user_id');
  return !error;
}

/**
 * Whether a given user wants the email for a notification type. Uses the
 * service-role client (reads another user's row) and defaults to true when no
 * preferences row exists. Called from the best-effort email sender.
 */
export async function shouldEmailUser(
  userId: string,
  kind: NotificationType,
): Promise<boolean> {
  const column = kind === 'task_assigned' ? 'email_task_assigned' : 'email_task_completed';
  const { data } = await prefsTable(createAdminClient())
    .select(column)
    .eq('user_id', userId)
    .maybeSingle();
  if (!data) return true;
  return (data as Record<string, boolean | null>)[column] !== false;
}
