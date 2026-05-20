'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

import { userHasPermission } from '@/lib/auth/permissions';
import { createClient } from '@/lib/supabase/server';

export type ConvertLeadResult = {
  ok: false;
  error: 'unauthorized' | 'not_found' | 'already_converted' | 'validation' | 'unknown';
};

export async function convertLeadAction(leadId: string): Promise<ConvertLeadResult> {
  if (typeof leadId !== 'string' || leadId.length === 0 || leadId.length > 100) {
    return { ok: false, error: 'validation' };
  }

  const supabase = await createClient();
  const { data: userRes } = await supabase.auth.getUser();
  if (!userRes.user) return { ok: false, error: 'unauthorized' };
  if (!(await userHasPermission('create_case'))) return { ok: false, error: 'unauthorized' };

  // convert_lead_to_case (migration 031) isn't in the generated Database types
  // yet. Cast the client to a narrow rpc signature, but call it as a normal
  // method so supabase-js keeps its `this` binding — a detached/bound reference
  // makes rpc read `this.rest` off undefined and throw. SECURITY DEFINER + an
  // internal has_permission check make the conversion atomic and authorized.
  const { data: caseId, error } = await (
    supabase as unknown as {
      rpc: (
        fn: 'convert_lead_to_case',
        args: { p_lead_id: string },
      ) => Promise<{ data: string | null; error: { message: string; code?: string } | null }>;
    }
  ).rpc('convert_lead_to_case', { p_lead_id: leadId });

  if (error || !caseId) {
    // The RPC raises with explicit SQLSTATEs — match those rather than the
    // (translatable / changeable) message text.
    switch (error?.code) {
      case '22023':
        return { ok: false, error: 'already_converted' };
      case 'P0002':
        return { ok: false, error: 'not_found' };
      case '42501':
        return { ok: false, error: 'unauthorized' };
      default:
        return { ok: false, error: 'unknown' };
    }
  }

  revalidatePath('/cases');
  redirect(`/cases/${caseId}/edit`);
}
