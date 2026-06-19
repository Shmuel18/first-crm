'use server';

import type { SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';

import { userCanEditCase, userHasPermission } from '@/lib/auth/permissions';
import { createClient } from '@/lib/supabase/server';

export type UpdateCaseFeePaidResult =
  | { ok: true; paidAt: string | null }
  | { ok: false; error: 'validation' | 'unauthorized' | 'unknown' };

const schema = z.object({
  caseId: z.uuid({ error: 'common.errors.invalidUuid' }),
  paid: z.boolean(),
});

/**
 * Mark the agreed fee as paid / unpaid on case_financials. The upsert is gated
 * by case_financials RLS (view_case_fee AND can_edit_case, migration 200) and we
 * fail fast on both here for clean UX. `fee_paid_at` is stamped to now() when
 * checked, cleared when unchecked. No revalidatePath — the admin block updates
 * optimistically and the heavy case page re-fetches fresh on the next load.
 */
export async function updateCaseFeePaidAction(
  caseId: string,
  paid: boolean,
): Promise<UpdateCaseFeePaidResult> {
  const parsed = schema.safeParse({ caseId, paid });
  if (!parsed.success) return { ok: false, error: 'validation' };

  if (!(await userHasPermission('view_case_fee'))) {
    return { ok: false, error: 'unauthorized' };
  }

  // ISS-01 defense-in-depth: per-case fee data needs case-edit authority, not
  // just the office-wide permission (case_financials RLS enforces it since
  // migration 200; this fails fast for a clean 'unauthorized').
  if (!(await userCanEditCase(parsed.data.caseId))) {
    return { ok: false, error: 'unauthorized' };
  }

  const supabase = await createClient();
  const { data: userRes } = await supabase.auth.getUser();
  if (!userRes.user) return { ok: false, error: 'unauthorized' };

  const paidAt = parsed.data.paid ? new Date().toISOString() : null;
  // fee_paid / fee_paid_at (migration 114) aren't in the generated types until
  // they're regenerated — use an untyped handle. upsert updates those two if
  // the row exists (preserving fee_amount/expected_income, not in the payload),
  // inserts otherwise.
  const db = supabase as unknown as SupabaseClient;
  const { error } = await db
    .from('case_financials')
    .upsert(
      {
        case_id: parsed.data.caseId,
        fee_paid: parsed.data.paid,
        fee_paid_at: paidAt,
        updated_by: userRes.user.id,
      },
      { onConflict: 'case_id' },
    );

  if (error) {
    console.error(
      '[updateCaseFeePaid] upsert error',
      JSON.stringify({ caseId, code: error.code ?? null }),
    );
    return { ok: false, error: 'unknown' };
  }

  return { ok: true, paidAt };
}
