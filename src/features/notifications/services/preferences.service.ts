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
    .select(
      'email_task_assigned, email_task_completed, email_mentions, email_task_reminder, email_case_status_overdue',
    )
    .eq('user_id', userRes.user.id)
    .maybeSingle();
  if (!data) return DEFAULT_NOTIFICATION_PREFERENCES;

  return {
    email_task_assigned: data.email_task_assigned !== false,
    email_task_completed: data.email_task_completed !== false,
    email_mentions: data.email_mentions !== false,
    email_task_reminder: data.email_task_reminder !== false,
    email_case_status_overdue: data.email_case_status_overdue !== false,
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
/** Preference column per notification type (types without a toggle never email via this path). */
const PREF_COLUMN: Partial<Record<NotificationType, keyof NotificationPreferences>> = {
  task_assigned: 'email_task_assigned',
  task_completed: 'email_task_completed',
  case_mention: 'email_mentions',
  task_mention: 'email_mentions',
  task_reminder: 'email_task_reminder',
  case_status_overdue: 'email_case_status_overdue',
};

export async function shouldEmailUser(
  userId: string,
  kind: NotificationType,
): Promise<boolean> {
  const column = PREF_COLUMN[kind];
  if (!column) return false;
  const { data } = await prefsTable(createAdminClient())
    .select(column)
    .eq('user_id', userId)
    .maybeSingle();
  if (!data) return true;
  return (data as Record<string, boolean | null>)[column] !== false;
}
