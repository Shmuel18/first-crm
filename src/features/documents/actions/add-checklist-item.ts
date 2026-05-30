'use server';

import { revalidatePath } from 'next/cache';

import { userCanEditCase } from '@/lib/auth/permissions';
import { createClient } from '@/lib/supabase/server';

import { ChecklistLabelSchema } from '../schemas/checklist.schema';

type Result =
  | { ok: true }
  | { ok: false; error: 'unauthorized' | 'validation' | 'unknown' };

/**
 * Append a free-text manual row to a case's checklist (the "פריט חדש" input).
 * The new row has no document category and is optional by default.
 */
export async function addChecklistItemAction(
  caseId: string,
  label: string,
): Promise<Result> {
  const parsed = ChecklistLabelSchema.safeParse(label);
  if (!parsed.success) return { ok: false, error: 'validation' };

  const supabase = await createClient();
  const { data: userRes } = await supabase.auth.getUser();
  if (!userRes.user) return { ok: false, error: 'unauthorized' };
  if (!(await userCanEditCase(caseId))) return { ok: false, error: 'unauthorized' };

  const { error } = await supabase.rpc('add_case_checklist_item', {
    p_case_id: caseId,
    p_label: parsed.data,
  });
  if (error) {
    console.error('[addChecklistItem] rpc failed', { caseId, code: error.code });
    return { ok: false, error: 'unknown' };
  }

  revalidatePath(`/cases/${caseId}/documents`);
  return { ok: true };
}
