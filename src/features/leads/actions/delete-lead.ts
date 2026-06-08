'use server';

import { revalidatePath } from 'next/cache';

import { userHasPermission } from '@/lib/auth/permissions';
import { createClient } from '@/lib/supabase/server';

export type DeleteLeadResult =
  | { ok: true }
  | { ok: false; error: 'unauthorized' | 'not_found' | 'validation' | 'unknown' };

/**
 * Soft-delete a lead (sets deleted_at). Gated on create_case — the same gate as
 * "convert to case". Hard DELETE is denied by RLS and leads_update is
 * edit_lead-scoped, so the write goes through the SECURITY DEFINER
 * soft_delete_lead RPC (migration 155), which re-checks create_case + lead
 * visibility server-side.
 */
export async function deleteLeadAction(leadId: string): Promise<DeleteLeadResult> {
  if (typeof leadId !== 'string' || leadId.length === 0 || leadId.length > 100) {
    return { ok: false, error: 'validation' };
  }

  const supabase = await createClient();
  const { data: userRes } = await supabase.auth.getUser();
  if (!userRes.user) return { ok: false, error: 'unauthorized' };
  if (!(await userHasPermission('create_case'))) return { ok: false, error: 'unauthorized' };

  // soft_delete_lead isn't in the generated Database types yet. Cast to a narrow
  // rpc signature but call it as a method so supabase-js keeps its `this`
  // binding (a detached reference makes rpc read `this.rest` off undefined).
  const { error } = await (
    supabase as unknown as {
      rpc: (
        fn: 'soft_delete_lead',
        args: { p_lead_id: string },
      ) => Promise<{ error: { message: string; code?: string } | null }>;
    }
  ).rpc('soft_delete_lead', { p_lead_id: leadId });

  if (error) {
    // The RPC raises explicit SQLSTATEs — map those, never leak error.message.
    switch (error.code) {
      case 'P0002':
        return { ok: false, error: 'not_found' };
      case '42501':
        return { ok: false, error: 'unauthorized' };
      default:
        console.error('[delete-lead] soft_delete_lead failed', error);
        return { ok: false, error: 'unknown' };
    }
  }

  revalidatePath('/cases');
  return { ok: true };
}
