import { createClient } from '@/lib/supabase/server';

import type { Notification, NotificationData, NotificationType } from '../types';

const RECENT_LIMIT = 15;

// Explicit column list (audit-driven) — gates schema-add propagation.
const NOTIFICATION_FULL_COLUMNS =
  'id, user_id, actor_id, type, case_id, task_id, data, read_at, created_at' as const;

export async function listRecentNotifications(): Promise<Notification[]> {
  const supabase = await createClient();
  const { data: userRes } = await supabase.auth.getUser();
  if (!userRes.user) return [];

  const { data, error } = await supabase
    .from('notifications')
    .select(NOTIFICATION_FULL_COLUMNS)
    .eq('user_id', userRes.user.id)
    .order('created_at', { ascending: false })
    .limit(RECENT_LIMIT);

  if (error) return [];
  return (data ?? []).map((row) => ({
    ...row,
    type: row.type as NotificationType,
    data: (row.data ?? {}) as NotificationData,
  }));
}

export async function countUnreadNotifications(): Promise<number> {
  const supabase = await createClient();
  const { data: userRes } = await supabase.auth.getUser();
  if (!userRes.user) return 0;

  const { count, error } = await supabase
    .from('notifications')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userRes.user.id)
    .is('read_at', null);

  if (error) return 0;
  return count ?? 0;
}
