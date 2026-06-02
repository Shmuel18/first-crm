import { cache } from 'react';

import { userHasPermission } from '@/lib/auth/permissions';
import { safeDbError } from '@/lib/supabase/db-error-log';
import { createClient } from '@/lib/supabase/server';
import type { NotificationData, NotificationType } from '@/features/notifications/types';
import { timeAsync } from '@/lib/perf/timing';

export type LayoutBootstrap = {
  authenticated: boolean;
  isAdmin: boolean;
  canCreateCase: boolean;
  pendingTasks: number;
  criticalTasks: number;
  unreadNotifications: number;
  profile: {
    first_name: string | null;
    last_name: string | null;
    phone: string | null;
    email: string | null;
    language: 'he' | 'en';
    roleNameHe: string | null;
    roleNameEn: string | null;
  } | null;
  recentNotifications: Array<{
    id: string;
    user_id: string;
    actor_id: string | null;
    type: NotificationType;
    case_id: string | null;
    task_id: string | null;
    data: NotificationData;
    read_at: string | null;
    created_at: string;
  }>;
};

const UNAUTHED: LayoutBootstrap = {
  authenticated: false,
  isAdmin: false,
  canCreateCase: false,
  pendingTasks: 0,
  criticalTasks: 0,
  unreadNotifications: 0,
  profile: null,
  recentNotifications: [],
};

/**
 * One-round-trip layout context (migration 066). React `cache` dedupes the
 * call across the AppLayout → Topbar → Sidebar render tree so the RPC fires
 * exactly once per request, regardless of how many components ask for it.
 *
 * Returns a sentinel `authenticated:false` envelope when no auth context
 * exists (the layout's redirect logic handles the actual sign-in flow).
 */
export const getLayoutBootstrap = cache(async (): Promise<LayoutBootstrap> => {
  const supabase = await createClient();
  const bootstrapClient = supabase as unknown as {
    rpc(
      fn: 'layout_bootstrap',
    ): Promise<{ data: unknown; error: { message: string } | null }>;
  };
  const { data, error } = await timeAsync('layout.bootstrap.rpc', () =>
    bootstrapClient.rpc('layout_bootstrap'),
  );

  if (error || !data || typeof data !== 'object') {
    if (error) console.error('[layout_bootstrap] rpc error', safeDbError(error));
    return UNAUTHED;
  }

  const envelope = data as Record<string, unknown>;
  if (envelope.authenticated !== true) return UNAUTHED;

  // Same check save-case-draft.ts enforces — keeps the "New case" affordance
  // in lockstep with the server guard so a non-permitted user never sees it.
  const canCreateCase = await userHasPermission('create_case');

  const profile = envelope.profile as Record<string, unknown> | null;
  const role =
    profile && typeof profile === 'object' && 'role' in profile
      ? (profile.role as { name_he?: string | null; name_en?: string | null } | null)
      : null;

  return {
    authenticated: true,
    isAdmin: envelope.is_admin === true,
    canCreateCase,
    pendingTasks: Number(envelope.pending_tasks ?? 0),
    criticalTasks: Number(envelope.critical_tasks ?? 0),
    unreadNotifications: Number(envelope.unread_notifications ?? 0),
    profile: profile
      ? {
          first_name: (profile.first_name as string | null) ?? null,
          last_name: (profile.last_name as string | null) ?? null,
          phone: (profile.phone as string | null) ?? null,
          email: (profile.email as string | null) ?? null,
          language: profile.language === 'en' ? 'en' : 'he',
          roleNameHe: role?.name_he ?? null,
          roleNameEn: role?.name_en ?? null,
        }
      : null,
    // Bell shows UNREAD only: a read notification disappears from the bell
    // (not just loses its highlight). The RPC returns the 15 most-recent
    // read+unread; keep the unread subset so a reload matches the client's
    // remove-on-read behavior in NotificationBell.
    recentNotifications: Array.isArray(envelope.recent_notifications)
      ? (envelope.recent_notifications as LayoutBootstrap['recentNotifications']).filter(
          (n) => !n.read_at,
        )
      : [],
  };
});
