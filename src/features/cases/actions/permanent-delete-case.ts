'use server';

import { revalidatePath } from 'next/cache';

import { isCurrentUserAdmin } from '@/lib/auth/permissions';
import { createAdminClient } from '@/lib/supabase/admin';

type Result =
  | { ok: true }
  | { ok: false; error: 'unauthorized' | 'not_found' | 'mismatch' | 'unknown' };

type Input = {
  caseId: string;
  /** The user must type the case_number to confirm. Mismatch → rejected. */
  confirmCaseNumber: string;
};

/**
 * Hard-delete a case from the database. Admin-only. Caller must echo back
 * the case_number string as confirmation — guards against misclicks and
 * accidental fan-out (e.g., a queued click event on the wrong row).
 *
 * Cascading on the FKs (case_banks, case_borrowers — both `ON DELETE
 * CASCADE` in migrations 006/007) removes the junctions. Documents have
 * their own `deleted_at` flow and aren't cascaded by case delete (their
 * blob cleanup runs in the orphan sweep, migration 026).
 *
 * Only callable on rows that are ALREADY soft-deleted. Two reasons:
 *   1. Forces the user through the recycle-bin UI (so they had to see
 *      the case is marked for deletion first).
 *   2. The `is_archived = TRUE` + alive cases path stays exclusively
 *      through `deleteCaseAction` → recycle-bin → here, with the audit
 *      trail of SOFT_DELETE then DELETE entries in order.
 */
export async function permanentDeleteCaseAction(input: Input): Promise<Result> {
  if (!(await isCurrentUserAdmin())) return { ok: false, error: 'unauthorized' };

  // Lookup with the session client so soft-deleted rows the caller can see
  // are visible — RLS allows admins to read deleted rows via cases_select?
  // No: the SELECT policy filters `deleted_at IS NULL`. So the lookup must
  // also go through the admin client.
  const admin = createAdminClient();

  // Verify the case exists, is soft-deleted, and the user's typed
  // case_number matches. One round-trip — cheaper than a separate
  // lookup-then-delete dance.
  const { data: target, error: lookupErr } = await admin
    .from('cases')
    .select('id, case_number, deleted_at')
    .eq('id', input.caseId)
    .maybeSingle();

  if (lookupErr) {
    console.error('[permanentDeleteCase] lookup failed', { code: lookupErr.code });
    return { ok: false, error: 'unknown' };
  }
  if (!target) return { ok: false, error: 'not_found' };
  if (!target.deleted_at) return { ok: false, error: 'not_found' };
  if (target.case_number.trim() !== input.confirmCaseNumber.trim()) {
    return { ok: false, error: 'mismatch' };
  }

  // Hard delete — the cases_delete RLS policy was dropped in migration 022
  // (soft-delete-only at the policy level). Admin bypass is the supported
  // route; the cleanup_soft_deleted_records sweep uses the same pattern.
  const { error: deleteErr } = await admin
    .from('cases')
    .delete()
    .eq('id', input.caseId)
    .not('deleted_at', 'is', null);

  if (deleteErr) {
    console.error('[permanentDeleteCase] delete failed', { code: deleteErr.code });
    return { ok: false, error: 'unknown' };
  }

  revalidatePath('/settings/recycle-bin');
  return { ok: true };
}
