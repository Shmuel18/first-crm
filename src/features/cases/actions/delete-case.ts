'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

import { userCanEditCase } from '@/lib/auth/permissions';
import { createClient } from '@/lib/supabase/server';

type Result =
  | { ok: true }
  | { ok: false; error: 'unauthorized' | 'unknown'; message?: string };

export async function softDeleteCaseAction(caseId: string): Promise<Result> {
  const supabase = await createClient();
  if (!(await userCanEditCase(caseId))) {
    return { ok: false, error: 'unauthorized' };
  }
  // .select() confirms a row changed — an RLS-denied update affects 0 rows
  // with no error and must not report success.
  const { data: deleted, error } = await supabase
    .from('cases')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', caseId)
    .select('id');

  if (error) return { ok: false, error: 'unknown', message: error.message };
  if (!deleted || deleted.length === 0) return { ok: false, error: 'unauthorized' };
  revalidatePath('/cases');
  redirect('/cases');
}

export async function toggleArchiveAction(
  caseId: string,
  archive: boolean,
): Promise<Result> {
  const supabase = await createClient();

  // Archiving and un-archiving are separate permissions per spec 3.6.5, and
  // the caller must also be able to edit the case (not merely see it).
  if (!(await userCanEditCase(caseId))) return { ok: false, error: 'unauthorized' };
  const permKey = archive ? 'archive_case' : 'restore_archived_case';
  const { data: hasPerm } = await supabase.rpc('has_permission', {
    perm_key: permKey,
  });
  if (hasPerm !== true) return { ok: false, error: 'unauthorized' };

  const { data: updated, error } = await supabase
    .from('cases')
    .update({ is_archived: archive })
    .eq('id', caseId)
    .select('id');

  if (error) return { ok: false, error: 'unknown', message: error.message };
  if (!updated || updated.length === 0) return { ok: false, error: 'unauthorized' };
  revalidatePath('/cases');
  revalidatePath(`/cases/${caseId}`);
  return { ok: true };
}

export async function updateCaseStatusAction(
  caseId: string,
  statusId: string,
): Promise<Result> {
  const supabase = await createClient();
  if (!(await userCanEditCase(caseId))) {
    return { ok: false, error: 'unauthorized' };
  }
  const { data: updated, error } = await supabase
    .from('cases')
    .update({ status_id: statusId })
    .eq('id', caseId)
    .select('id');

  if (error) return { ok: false, error: 'unknown', message: error.message };
  if (!updated || updated.length === 0) return { ok: false, error: 'unauthorized' };
  revalidatePath('/cases');
  revalidatePath(`/cases/${caseId}`);
  return { ok: true };
}
