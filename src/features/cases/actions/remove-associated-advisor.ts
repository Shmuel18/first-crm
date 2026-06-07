'use server';

import { z } from 'zod';

import { userHasPermission } from '@/lib/auth/permissions';
import { createClient } from '@/lib/supabase/server';

import { deleteAssociatedAdvisor } from '../services/case-advisors.service';

type Result = { ok: true } | { ok: false; error: 'unauthorized' | 'validation' | 'unknown' };

const schema = z.object({ caseId: z.uuid(), advisorId: z.uuid() });

/**
 * Remove an associated advisor from a case (migration 146). Gated on
 * `assign_case_to_user`, the same permission that adds them. RLS enforces the
 * case scope; the service's row-count guard turns an RLS-denied delete into a
 * clean unauthorized result.
 */
export async function removeAssociatedAdvisorAction(
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

  const ok = await deleteAssociatedAdvisor(parsed.data.caseId, parsed.data.advisorId);
  if (!ok) return { ok: false, error: 'unauthorized' };

  // NO revalidatePath — the field is optimistic; revalidating the heavy
  // /cases/[id] page re-renders everything and collapses the admin block.
  // (Same pattern as the inline case-banks list.)
  return { ok: true };
}
