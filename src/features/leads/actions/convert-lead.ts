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
  // yet; call it through a narrowly-typed rpc view. SECURITY DEFINER + an
  // internal has_permission check make the conversion atomic and authorized.
  const rpc = supabase.rpc as unknown as (
    fn: 'convert_lead_to_case',
    args: { p_lead_id: string },
  ) => Promise<{ data: string | null; error: { message: string } | null }>;

  const { data: caseId, error } = await rpc('convert_lead_to_case', { p_lead_id: leadId });

  if (error || !caseId) {
    const msg = error?.message ?? '';
    if (msg.includes('already converted')) return { ok: false, error: 'already_converted' };
    if (msg.includes('not found')) return { ok: false, error: 'not_found' };
    if (msg.includes('not authorized')) return { ok: false, error: 'unauthorized' };
    return { ok: false, error: 'unknown' };
  }

  revalidatePath('/cases');
  redirect(`/cases/${caseId}/edit`);
}
