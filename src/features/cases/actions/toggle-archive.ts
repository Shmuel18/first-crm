'use server';

import { revalidatePath } from 'next/cache';
import { after } from 'next/server';

import { userCanEditCase } from '@/lib/auth/permissions';
import { safeDbError } from '@/lib/supabase/db-error-log';
import { createClient } from '@/lib/supabase/server';

type Result =
  | { ok: true }
  | { ok: false; error: 'unauthorized' | 'unknown'; message?: string };

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

  if (error) {
    console.error('[toggleArchive] db error', safeDbError(error));
    return { ok: false, error: 'unknown' };
  }
  if (!updated || updated.length === 0) return { ok: false, error: 'unauthorized' };
  // The caller (CaseMoreMenu) already calls router.refresh() on success, which re-
  // renders the current /cases/[id] page — so revalidating it here just doubled the
  // heavy re-render and kept the menu's pending state up. Purge the dashboard list
  // AFTER the response (the user stays on the case page; /cases matters on the next
  // visit, when the archived filter must reflect the change).
  after(() => revalidatePath('/cases'));
  return { ok: true };
}
