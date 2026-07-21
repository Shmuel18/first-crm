import type { SupabaseClient } from '@supabase/supabase-js';

import { getUnreadStarConfig } from '@/features/settings/services/settings.service';
import { createClient } from '@/lib/supabase/server';

import { isCaseUnread, unreadResetBoundary } from '../domain/unread-star';
import type { CaseWithRelations } from '../types';

/**
 * Manager-only: which of these cases are "unread" (not opened since the current
 * reset boundary). Returns [] for non-managers or when the feature is off, so
 * the dashboard renders no stars at all in those cases without extra branching.
 *
 * The reset boundary is computed (domain/unread-star.ts) from the office
 * cadence — no cron. case_review_state holds one row per opened case (migration
 * 219); it isn't in the generated types yet, so an untyped handle reads it.
 */
export async function getUnreadCaseIds(
  cases: ReadonlyArray<CaseWithRelations>,
  isManager: boolean,
): Promise<string[]> {
  if (!isManager || cases.length === 0) return [];

  const { cadence, weekday } = await getUnreadStarConfig();
  const boundary = unreadResetBoundary(cadence, weekday);
  if (boundary === null) return [];

  const supabase = await createClient();
  const db = supabase as unknown as SupabaseClient;
  const { data, error } = await db
    .from('case_review_state')
    .select('case_id, manager_viewed_at');

  if (error) {
    console.error('[getUnreadCaseIds] read failed', { code: error.code });
    return [];
  }

  const viewedAt = new Map<string, string>();
  for (const row of (data ?? []) as Array<{ case_id: string; manager_viewed_at: string }>) {
    viewedAt.set(row.case_id, row.manager_viewed_at);
  }

  return cases.filter((c) => isCaseUnread(viewedAt.get(c.id) ?? null, boundary)).map((c) => c.id);
}
