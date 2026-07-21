'use server';

import type { SupabaseClient } from '@supabase/supabase-js';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';

import { isCurrentUserAdmin } from '@/lib/auth/permissions';
import { createClient } from '@/lib/supabase/server';

type Result = { ok: true } | { ok: false };

const schema = z.uuid();

/**
 * Stamp "the manager just opened this case" → clears its dashboard unread star.
 * Manager-only (case_review_state RLS also enforces is_admin, migration 219).
 * Fire-and-forget from the case page's mount; revalidates /cases so the star is
 * gone on the next dashboard visit rather than lingering from the router cache.
 * A stray non-manager call is a harmless no-op (RLS drops the write).
 */
export async function markCaseViewedAction(caseId: string): Promise<Result> {
  const parsed = schema.safeParse(caseId);
  if (!parsed.success) return { ok: false };

  if (!(await isCurrentUserAdmin())) return { ok: false };

  const supabase = await createClient();
  // case_review_state isn't in the generated types until they're regenerated —
  // use an untyped handle (same pattern as the fee_paid columns).
  const db = supabase as unknown as SupabaseClient;
  const { error } = await db
    .from('case_review_state')
    .upsert(
      { case_id: parsed.data, manager_viewed_at: new Date().toISOString() },
      { onConflict: 'case_id' },
    );

  if (error) {
    console.error('[markCaseViewed] upsert error', { code: error.code });
    return { ok: false };
  }

  revalidatePath('/cases');
  return { ok: true };
}
