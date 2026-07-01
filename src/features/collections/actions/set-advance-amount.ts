'use server';

import { z } from 'zod';

import { userHasPermission } from '@/lib/auth/permissions';
import { createClient } from '@/lib/supabase/server';

const Schema = z.object({
  caseId: z.uuid(),
  // null = no advance agreed; positive number = advance of that amount
  amount: z.number().nonnegative().nullable(),
});

export type SetAdvanceAmountResult =
  | { ok: true }
  | { ok: false; error: 'unauthorized' | 'unknown' };

export async function setAdvanceAmountAction(
  caseId: string,
  amount: number | null,
): Promise<SetAdvanceAmountResult> {
  const parsed = Schema.safeParse({ caseId, amount });
  if (!parsed.success) return { ok: false, error: 'unknown' };

  if (!(await userHasPermission('manage_collections'))) {
    return { ok: false, error: 'unauthorized' };
  }

  const supabase = await createClient();
  // advance_amount added in migration 212; advance_agreed synced for backward compat.
  // Both columns not yet in database.ts — cast is safe: fields validated above.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const updatePayload = {
    advance_amount: parsed.data.amount,
    advance_agreed: parsed.data.amount != null && parsed.data.amount > 0,
  } as any;
  const { error } = await supabase
    .from('case_financials')
    .update(updatePayload)
    .eq('case_id', parsed.data.caseId);

  if (error) {
    console.error('[collections] set_advance_amount error', error.code);
    return { ok: false, error: 'unknown' };
  }
  return { ok: true };
}
