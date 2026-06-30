'use server';

import { z } from 'zod';

import { userHasPermission } from '@/lib/auth/permissions';
import { createClient } from '@/lib/supabase/server';

const Schema = z.object({
  caseId: z.uuid(),
  agreed: z.boolean(),
});

export type SetAdvanceAgreedResult =
  | { ok: true }
  | { ok: false; error: 'unauthorized' | 'unknown' };

export async function setAdvanceAgreedAction(
  caseId: string,
  agreed: boolean,
): Promise<SetAdvanceAgreedResult> {
  const parsed = Schema.safeParse({ caseId, agreed });
  if (!parsed.success) return { ok: false, error: 'unknown' };

  if (!(await userHasPermission('manage_collections'))) {
    return { ok: false, error: 'unauthorized' };
  }

  const supabase = await createClient();
  // advance_agreed added in migration 210 — column not yet in database.ts.
  // Cast is safe: the field and value are both validated above.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const updatePayload = { advance_agreed: parsed.data.agreed } as any;
  const { error } = await supabase
    .from('case_financials')
    .update(updatePayload)
    .eq('case_id', parsed.data.caseId);

  if (error) {
    console.error('[collections] set_advance_agreed error', error.code);
    return { ok: false, error: 'unknown' };
  }
  return { ok: true };
}
