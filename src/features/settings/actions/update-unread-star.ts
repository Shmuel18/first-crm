'use server';

import type { SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';

import { isCurrentUserAdmin } from '@/lib/auth/permissions';
import { createClient } from '@/lib/supabase/server';

type Result = { ok: true } | { ok: false; error: 'unauthorized' | 'validation' | 'unknown' };

const schema = z.object({
  cadence: z.enum(['off', 'daily', 'weekly']),
  weekday: z.number().int().min(0).max(6),
});

/**
 * Update the office-wide unread-star cadence (migration 219). Admin-only;
 * office_settings RLS enforces the same at the DB boundary. The columns aren't
 * in the generated types until regenerated, so an untyped handle writes them
 * (same pattern as the fee_paid columns). No revalidate — the control is
 * optimistic and /cases re-reads the config on its next render.
 */
export async function updateUnreadStarAction(cadence: string, weekday: number): Promise<Result> {
  const parsed = schema.safeParse({ cadence, weekday });
  if (!parsed.success) return { ok: false, error: 'validation' };

  const supabase = await createClient();
  const { data: userRes } = await supabase.auth.getUser();
  if (!userRes.user) return { ok: false, error: 'unauthorized' };
  if (!(await isCurrentUserAdmin())) return { ok: false, error: 'unauthorized' };

  const db = supabase as unknown as SupabaseClient;
  const { data: updated, error } = await db
    .from('office_settings')
    .update({
      unread_star_cadence: parsed.data.cadence,
      unread_star_weekday: parsed.data.weekday,
      updated_by: userRes.user.id,
    })
    .eq('id', 1)
    .select('id');

  if (error) {
    console.error('[updateUnreadStar] update failed', { code: error.code });
    return { ok: false, error: 'unknown' };
  }
  if (!updated || updated.length === 0) return { ok: false, error: 'unauthorized' };

  return { ok: true };
}
