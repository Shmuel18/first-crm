'use server';

import { revalidatePath } from 'next/cache';

import { userCanEditCase } from '@/lib/auth/permissions';
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

  // Defense-in-depth: caller must be able to edit this case before mutating.
  if (!(await userCanEditCase(caseId))) return { ok: false, error: 'unauthorized' };

  // .select() confirms a link row was actually removed (0 rows = RLS denied
  // or no such link → fail instead of false success).
  const { data: removed, error } = await supabase
    .from('case_borrowers')
    .delete()
    .eq('case_id', caseId)
    .eq('borrower_id', borrowerId)
    .select('borrower_id');
  if (error) return { ok: false, error: 'unknown', message: error.message };
  if (!removed || removed.length === 0) return { ok: false, error: 'unauthorized' };

  revalidatePath(`/cases/${caseId}`);
  return { ok: true };
}
