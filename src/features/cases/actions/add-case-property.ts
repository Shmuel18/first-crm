'use server';

import { userCanEditCase } from '@/lib/auth/permissions';
import { createClient } from '@/lib/supabase/server';

export type AddCasePropertyResult =
  | { ok: true; id: string }
  | { ok: false; error: 'unauthorized' | 'unknown' };

type InsertClient = {
  from: (table: 'case_properties') => {
    insert: (row: { case_id: string; created_by: string; updated_by: string }) => {
      select: (cols: 'id') => {
        single: () => PromiseLike<{
          data: { id: string } | null;
          error: { message: string } | null;
        }>;
      };
    };
  };
};

/**
 * Add a blank additional property to a case. Gated on edit access (userCanEditCase
 * + RLS). Returns the new row id so the client can append it optimistically
 * (no revalidatePath — the /cases/[id] page is heavy; we avoid the scroll-jump).
 */
export async function addCasePropertyAction(caseId: string): Promise<AddCasePropertyResult> {
  if (typeof caseId !== 'string' || caseId.length === 0 || caseId.length > 100) {
    return { ok: false, error: 'unknown' };
  }
  if (!(await userCanEditCase(caseId))) return { ok: false, error: 'unauthorized' };

  const supabase = await createClient();
  const { data: userRes } = await supabase.auth.getUser();
  if (!userRes.user) return { ok: false, error: 'unauthorized' };

  const { data, error } = await (supabase as unknown as InsertClient)
    .from('case_properties')
    .insert({ case_id: caseId, created_by: userRes.user.id, updated_by: userRes.user.id })
    .select('id')
    .single();

  if (error || !data) {
    console.error('[add-case-property] insert error', error?.message);
    return { ok: false, error: 'unknown' };
  }
  return { ok: true, id: data.id };
}
