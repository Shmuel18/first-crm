'use server';

import { revalidatePath } from 'next/cache';

import { z } from 'zod';

import { userCanEditCase, userHasPermission } from '@/lib/auth/permissions';
import { createClient } from '@/lib/supabase/server';

type Result = { ok: true } | { ok: false; error: 'validation' | 'unauthorized' | 'unknown' };

const CaseIdSchema = z.string().uuid();

/**
 * Send a case back to the leads list (migration 251). The case is archived,
 * never deleted, and the lead points at it — converting that lead later
 * revives the same case. archive_case + create_lead + edit authority, the same
 * gates return_case_to_lead re-checks in the database.
 */
export async function returnCaseToLeadAction(caseId: string): Promise<Result> {
  const parsed = CaseIdSchema.safeParse(caseId);
  if (!parsed.success) return { ok: false, error: 'validation' };

  const supabase = await createClient();
  const { data: userRes } = await supabase.auth.getUser();
  if (!userRes.user) return { ok: false, error: 'unauthorized' };
  if (
    !(await userHasPermission('archive_case')) ||
    !(await userHasPermission('create_lead')) ||
    !(await userCanEditCase(parsed.data))
  ) {
    return { ok: false, error: 'unauthorized' };
  }

  const { error } = await supabase.rpc('return_case_to_lead', { p_case_id: parsed.data });
  if (error) {
    console.error('[returnCaseToLead] db error', { caseId, code: error.code, message: error.message });
    return { ok: false, error: error.code === '42501' ? 'unauthorized' : 'unknown' };
  }

  revalidatePath('/cases');
  return { ok: true };
}
