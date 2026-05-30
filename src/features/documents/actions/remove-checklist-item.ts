'use server';

import { revalidatePath } from 'next/cache';

import { userCanEditCase } from '@/lib/auth/permissions';
import { createClient } from '@/lib/supabase/server';

type Result = { ok: true } | { ok: false; error: 'unauthorized' | 'unknown' };

/**
 * Remove a checklist row. The UI confirms first when a linked document
 * exists; the document itself is never deleted here (the row just stops
 * appearing in the checklist). See migration 099.
 */
export async function removeChecklistItemAction(
  caseId: string,
  itemId: string,
): Promise<Result> {
  const supabase = await createClient();
  const { data: userRes } = await supabase.auth.getUser();
  if (!userRes.user) return { ok: false, error: 'unauthorized' };
  if (!(await userCanEditCase(caseId))) return { ok: false, error: 'unauthorized' };

  const { error } = await supabase.rpc('remove_case_checklist_item', {
    p_case_id: caseId,
    p_item_id: itemId,
  });
  if (error) {
    console.error('[removeChecklistItem] rpc failed', { caseId, code: error.code });
    return { ok: false, error: 'unknown' };
  }

  revalidatePath(`/cases/${caseId}/documents`);
  return { ok: true };
}
