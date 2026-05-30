'use server';

import { revalidatePath } from 'next/cache';

import { userCanEditCase } from '@/lib/auth/permissions';
import { createClient } from '@/lib/supabase/server';

type Result = { ok: true } | { ok: false; error: 'unauthorized' | 'unknown' };

/**
 * Toggle the manual "received" tick on a checklist row. Independent of any
 * uploaded document — lets the user close a row for a doc that arrived
 * out-of-band (e.g. WhatsApp). See migration 099.
 */
export async function toggleChecklistItemAction(
  caseId: string,
  itemId: string,
  done: boolean,
): Promise<Result> {
  const supabase = await createClient();
  const { data: userRes } = await supabase.auth.getUser();
  if (!userRes.user) return { ok: false, error: 'unauthorized' };
  if (!(await userCanEditCase(caseId))) return { ok: false, error: 'unauthorized' };

  const { error } = await supabase.rpc('toggle_case_checklist_item', {
    p_case_id: caseId,
    p_item_id: itemId,
    p_done: done,
  });
  if (error) {
    console.error('[toggleChecklistItem] rpc failed', { caseId, code: error.code });
    return { ok: false, error: 'unknown' };
  }

  revalidatePath(`/cases/${caseId}/documents`);
  return { ok: true };
}
