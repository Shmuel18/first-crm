'use server';

import { z } from 'zod';

import { userHasPermission } from '@/lib/auth/permissions';
import { createClient } from '@/lib/supabase/server';

import { insertAssociatedAdvisor } from '../services/case-advisors.service';

type Result =
  | { ok: true }
  | { ok: false; error: 'unauthorized' | 'validation' | 'is_responsible' | 'unknown' };

const schema = z.object({ caseId: z.uuid(), advisorId: z.uuid() });

/**
 * Associate a secondary advisor to a case (the "יועץ משוייך" — migration 146).
 * Gated on `assign_case_to_user` (the same permission that controls assigning
 * the responsible advisor). The responsible advisor can't also be associated —
 * they already have full access. RLS enforces the case scope too.
 */
export async function addAssociatedAdvisorAction(
  caseId: string,
  advisorId: string,
): Promise<Result> {
  const parsed = schema.safeParse({ caseId, advisorId });
  if (!parsed.success) return { ok: false, error: 'validation' };

  const supabase = await createClient();
  const { data: userRes } = await supabase.auth.getUser();
  if (!userRes.user) return { ok: false, error: 'unauthorized' };
  if (!(await userHasPermission('assign_case_to_user'))) {
    return { ok: false, error: 'unauthorized' };
  }

  // The responsible advisor already has full access — don't duplicate them as
  // an associate. Also confirms the case is visible/exists to this caller.
  const { data: caseRow } = await supabase
    .from('cases')
    .select('assigned_advisor_id')
    .eq('id', parsed.data.caseId)
    .is('deleted_at', null)
    .maybeSingle();
  if (!caseRow) return { ok: false, error: 'unauthorized' };
  if (caseRow.assigned_advisor_id === parsed.data.advisorId) {
    return { ok: false, error: 'is_responsible' };
  }

  const result = await insertAssociatedAdvisor(
    parsed.data.caseId,
    parsed.data.advisorId,
    userRes.user.id,
  );
  if (!result.ok) return { ok: false, error: 'unknown' };

  // NO revalidatePath: the field updates optimistically client-side, and
  // revalidating the heavy /cases/[id] Server Component re-renders the whole
  // page — collapsing the admin block and causing a visible re-render flash.
  // The next natural navigation reloads the canonical list. (Same pattern as
  // the inline case-banks list — see feedback_optimistic_inline_mutations.)
  return { ok: true };
}
