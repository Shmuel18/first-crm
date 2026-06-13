'use server';

import { userHasPermission } from '@/lib/auth/permissions';
import { createClient } from '@/lib/supabase/server';
import { formDataToObject, formDataToValues } from '@/lib/utils/form-data';
import { resolveSchemaErrors } from '@/lib/validators/i18n-errors';

import { LeadFormSchema } from '../schemas/lead.schema';
import type { LeadActionState } from '../types';

export async function createLeadAction(
  _prevState: LeadActionState,
  formData: FormData,
): Promise<LeadActionState> {
  const values = formDataToValues(formData);

  const parsed = LeadFormSchema.safeParse(formDataToObject(formData));
  if (!parsed.success) {
    const fieldErrors = await resolveSchemaErrors(parsed.error);
    return { ok: false, error: 'validation', fieldErrors, values };
  }

  const supabase = await createClient();
  const { data: userRes } = await supabase.auth.getUser();
  if (!userRes.user) return { ok: false, error: 'unauthorized', values };
  if (!(await userHasPermission('create_lead'))) {
    return { ok: false, error: 'unauthorized', values };
  }

  // R4-leads-1: only a view_all_leads holder (manager/secretary) may assign to
  // another advisor or leave a lead unassigned; everyone else can only own the
  // leads they create. leads_insert RLS (mig 174) is the DB-level backstop.
  const canAssignOthers = await userHasPermission('view_all_leads');
  const assignedTo = canAssignOthers ? (parsed.data.assigned_to ?? null) : userRes.user.id;

  const { data, error } = await supabase
    .from('leads')
    .insert({
      first_name: parsed.data.first_name,
      last_name: parsed.data.last_name ?? null,
      phone: parsed.data.phone ?? null,
      email: parsed.data.email ?? null,
      national_id: parsed.data.national_id ?? null,
      notes: parsed.data.notes ?? null,
      assigned_to: assignedTo,
      created_by: userRes.user.id,
      updated_by: userRes.user.id,
    })
    .select('id')
    .single();

  // R4-xcut-4: log server-side (code only, never error.message) so an RLS or
  // constraint failure is diagnosable, matching the sibling lead actions.
  if (error || !data) {
    console.error('[createLead] insert failed', { code: error?.code });
    return { ok: false, error: 'unknown', values };
  }

  return { ok: true, leadId: data.id };
}
