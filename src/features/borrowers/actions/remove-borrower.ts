'use server';

import { revalidatePath } from 'next/cache';

import { createClient } from '@/lib/supabase/server';

type Result =
  | { ok: true }
  | { ok: false; error: 'unauthorized' | 'unknown'; message?: string };

export async function removeBorrowerFromCaseAction(
  caseId: string,
  borrowerId: string,
): Promise<Result> {
  const supabase = await createClient();

  const { data: userRes } = await supabase.auth.getUser();
  if (!userRes.user) return { ok: false, error: 'unauthorized' };

  // Defense-in-depth: confirm the caller can see the case before mutating
  const { data: caseRow } = await supabase
    .from('cases')
    .select('id')
    .eq('id', caseId)
    .maybeSingle();
  if (!caseRow) return { ok: false, error: 'unauthorized' };

  const { error } = await supabase
    .from('case_borrowers')
    .delete()
    .eq('case_id', caseId)
    .eq('borrower_id', borrowerId);
  if (error) return { ok: false, error: 'unknown', message: error.message };

  revalidatePath(`/cases/${caseId}`);
  return { ok: true };
}
