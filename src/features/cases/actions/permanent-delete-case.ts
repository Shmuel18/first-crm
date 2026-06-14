'use server';

import { revalidatePath } from 'next/cache';

import { isCurrentUserAdmin } from '@/lib/auth/permissions';
import { createClient } from '@/lib/supabase/server';

import { collectCaseFileRefs, eraseCaseFiles } from '../services/erase-case-files';

type Result =
  | { ok: true }
  | {
      ok: false;
      error: 'unauthorized' | 'not_found' | 'mismatch' | 'retention_paused' | 'unknown';
    };

type Input = {
  caseId: string;
  /** The user must type the case_number to confirm. Mismatch -> rejected. */
  confirmCaseNumber: string;
};

/**
 * Hard-delete a soft-deleted case through a narrow DB RPC. This remains a
 * conscious retention-policy exception until the business decides on cold
 * storage vs permanent purge.
 */
export async function permanentDeleteCaseAction(input: Input): Promise<Result> {
  if (!(await isCurrentUserAdmin())) return { ok: false, error: 'unauthorized' };

  const supabase = await createClient();

  // Gather file references BEFORE the hard delete: the cascade removes the
  // documents rows, after which the Storage paths + Drive ids are unrecoverable.
  // FAIL-CLOSED: if collection fails, do NOT delete — otherwise we'd orphan the
  // files with no way to recover their pointers (R5-lifecycle-2 follow-up).
  const collected = await collectCaseFileRefs(input.caseId);
  if (!collected.ok) {
    console.error('[permanentDeleteCase] aborting — file-ref collection failed', {
      caseId: input.caseId,
    });
    return { ok: false, error: 'unknown' };
  }

  const { data: deleted, error } = await supabase.rpc('permanently_delete_case', {
    p_case_id: input.caseId,
    p_confirm_case_number: input.confirmCaseNumber,
  });

  if (error) {
    if (error.code === '22023') return { ok: false, error: 'mismatch' };
    // Retention hold active (mig 177): permanent delete is paused.
    if (error.code === 'PT001') return { ok: false, error: 'retention_paused' };
    console.error('[permanentDeleteCase] delete failed', { code: error.code });
    return { ok: false, error: 'unknown' };
  }
  if (deleted !== true) return { ok: false, error: 'not_found' };

  // Row erased — now erase the actual files (LEGAL-3 right-to-erasure). Best-
  // effort + logged: the DB delete already succeeded, so a file-cleanup hiccup
  // must not turn a completed erasure into an error.
  await eraseCaseFiles(input.caseId, collected.refs);

  revalidatePath('/settings/recycle-bin');
  return { ok: true };
}
