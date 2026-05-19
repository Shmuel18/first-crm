'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

import { createClient } from '@/lib/supabase/server';

type Result =
  | { ok: true }
  | { ok: false; error: 'unauthorized' | 'unknown'; message?: string };

async function ensureAccess(
  supabase: Awaited<ReturnType<typeof createClient>>,
  caseId: string,
): Promise<boolean> {
  const { data: userRes } = await supabase.auth.getUser();
  if (!userRes.user) return false;
  const { data: caseRow } = await supabase
    .from('cases')
    .select('id')
    .eq('id', caseId)
    .maybeSingle();
  return Boolean(caseRow);
}

export async function softDeleteCaseAction(caseId: string): Promise<Result> {
  const supabase = await createClient();
  if (!(await ensureAccess(supabase, caseId))) {
    return { ok: false, error: 'unauthorized' };
  }
  const { error } = await supabase
    .from('cases')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', caseId);

  if (error) return { ok: false, error: 'unknown', message: error.message };
  revalidatePath('/cases');
  redirect('/cases');
}

export async function toggleArchiveAction(
  caseId: string,
  archive: boolean,
): Promise<Result> {
  const supabase = await createClient();
  if (!(await ensureAccess(supabase, caseId))) {
    return { ok: false, error: 'unauthorized' };
  }

  // Archiving and un-archiving are separate permissions per spec 3.6.5.
  // ensureAccess only checks "can see the case" - this guards the action
  // itself (someone with edit_own_case shouldn't necessarily be able to
  // archive cases).
  const permKey = archive ? 'archive_case' : 'restore_archived_case';
  const { data: hasPerm } = await supabase.rpc('has_permission', {
    perm_key: permKey,
  });
  if (hasPerm !== true) return { ok: false, error: 'unauthorized' };

  const { error } = await supabase
    .from('cases')
    .update({ is_archived: archive })
    .eq('id', caseId);

  if (error) return { ok: false, error: 'unknown', message: error.message };
  revalidatePath('/cases');
  revalidatePath(`/cases/${caseId}`);
  return { ok: true };
}

export async function updateCaseStatusAction(
  caseId: string,
  statusId: string,
): Promise<Result> {
  const supabase = await createClient();
  if (!(await ensureAccess(supabase, caseId))) {
    return { ok: false, error: 'unauthorized' };
  }
  const { error } = await supabase
    .from('cases')
    .update({ status_id: statusId })
    .eq('id', caseId);

  if (error) return { ok: false, error: 'unknown', message: error.message };
  revalidatePath('/cases');
  revalidatePath(`/cases/${caseId}`);
  return { ok: true };
}
