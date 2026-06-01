'use server';

import type { SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';

import { userHasPermission } from '@/lib/auth/permissions';
import { createClient } from '@/lib/supabase/server';

export type UpdateCaseFeePaidResult =
  | { ok: true; paidAt: string | null }
  | { ok: false; error: 'validation' | 'unauthorized' | 'unknown' };

const schema = z.object({
  caseId: z.uuid({ error: 'common.errors.invalidUuid' }),
  paid: z.boolean(),
});

/**
 * Mark the agreed fee as paid / unpaid on case_financials. Manager-only: the
 * upsert is gated by case_financials RLS (is_admin, migration 025) and we fail
 * fast on `view_case_fee` for clean UX. `fee_paid_at` is stamped to now() when
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
