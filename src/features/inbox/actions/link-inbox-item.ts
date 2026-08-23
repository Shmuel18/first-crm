'use server';

import { userCanEditCase } from '@/lib/auth/permissions';
import { createClient } from '@/lib/supabase/server';
import { safeDbError } from '@/lib/supabase/db-error-log';

type Result =
  | { ok: true; caseId: string }
  | { ok: false; error: 'unauthorized' | 'validation' | 'case_not_found' | 'unknown' };

/**
 * Resolve a queued email to a case BY CASE NUMBER (what the advisor knows by
 * heart). Linking acknowledges the item — it leaves the הקפצה queue with a
 * human decision on record.
 */
export async function linkInboxItemToCaseAction(
  itemId: string,
  caseNumberRaw: string,
): Promise<Result> {
  const caseNumber = caseNumberRaw.trim();
  if (!itemId || !caseNumber) return { ok: false, error: 'validation' };

  const supabase = await createClient();
  const { data: userRes } = await supabase.auth.getUser();
  if (!userRes.user) return { ok: false, error: 'unauthorized' };

  // RLS scopes the lookup to cases the caller can see.
  const { data: caseRow, error: caseErr } = await supabase
    .from('cases')
    .select('id')
    .eq('case_number', caseNumber)
    .is('deleted_at', null)
    .maybeSingle();
  if (caseErr) {
    console.error('[linkInboxItem] case lookup failed', safeDbError(caseErr));
    return { ok: false, error: 'unknown' };
  }
  if (!caseRow) return { ok: false, error: 'case_not_found' };
  if (!(await userCanEditCase(caseRow.id))) return { ok: false, error: 'unauthorized' };

  const { data, error } = await supabase
    .from('email_inbox')
    .update({
      case_id: caseRow.id,
      status: 'acknowledged',
      resolved_by: userRes.user.id,
      resolved_at: new Date().toISOString(),
    })
    .eq('id', itemId)
    .select('id')
    .maybeSingle();

  if (error) {
    console.error('[linkInboxItem] db error', safeDbError(error));
    return { ok: false, error: 'unknown' };
  }
  if (!data) return { ok: false, error: 'unauthorized' };
  return { ok: true, caseId: caseRow.id };
}
