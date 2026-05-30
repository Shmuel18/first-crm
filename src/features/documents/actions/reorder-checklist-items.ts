'use server';

import { revalidatePath } from 'next/cache';

import { userCanEditCase } from '@/lib/auth/permissions';
import { createClient } from '@/lib/supabase/server';

import { ChecklistOrderSchema } from '../schemas/checklist.schema';

type Result =
  | { ok: true }
  | { ok: false; error: 'unauthorized' | 'validation' | 'unknown' };

/**
 * Persist a new row order after a drag. `orderedIds` is the full list of
 * item ids in their new top-to-bottom order. See migration 099.
 */
export async function reorderChecklistItemsAction(
  caseId: string,
  orderedIds: string[],
): Promise<Result> {
  const parsed = ChecklistOrderSchema.safeParse(orderedIds);
  if (!parsed.success) return { ok: false, error: 'validation' };

  const supabase = await createClient();
  const { data: userRes } = await supabase.auth.getUser();
  if (!userRes.user) return { ok: false, error: 'unauthorized' };
  if (!(await userCanEditCase(caseId))) return { ok: false, error: 'unauthorized' };

  const { error } = await supabase.rpc('reorder_case_checklist_items', {
    p_case_id: caseId,
    p_ids: parsed.data,
  });
  if (error) {
    console.error('[reorderChecklistItems] rpc failed', { caseId, code: error.code });
    return { ok: false, error: 'unknown' };
  }

  revalidatePath(`/cases/${caseId}/documents`);
  return { ok: true };
}
