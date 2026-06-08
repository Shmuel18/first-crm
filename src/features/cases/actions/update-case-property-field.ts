'use server';

import { userCanEditCase } from '@/lib/auth/permissions';
import { createClient } from '@/lib/supabase/server';

const EDITABLE_PROPERTY_FIELDS = [
  'case_type_primary_id',
  'case_type_other_text',
  'city',
  'property_value',
  'requested_mortgage_amount',
] as const;
type EditablePropertyField = (typeof EDITABLE_PROPERTY_FIELDS)[number];

export type UpdateCasePropertyResult =
  | { ok: true }
  | { ok: false; error: 'invalid_field' | 'unauthorized' | 'unknown' };

function isEditablePropertyField(field: string): field is EditablePropertyField {
  return (EDITABLE_PROPERTY_FIELDS as readonly string[]).includes(field);
}

function coerce(field: EditablePropertyField, value: string | null): string | number | null {
  if (value === null || value === '') return null;
  if (field === 'property_value' || field === 'requested_mortgage_amount') {
    const n = Number(value);
    return Number.isFinite(n) && n >= 0 ? n : null;
  }
  return value;
}

type UpdateClient = {
  from: (table: 'case_properties') => {
    update: (patch: Record<string, unknown>) => {
      eq: (col: 'id', val: string) => {
        eq: (col: 'case_id', val: string) => {
          is: (col: 'deleted_at', val: null) => PromiseLike<{ error: { message: string } | null }>;
        };
      };
    };
  };
};

/**
 * Patch a single field on an additional property row. Whitelisted fields only;
 * numbers coerced + clamped non-negative. Edit-gated (userCanEditCase + RLS).
 * No revalidatePath — the client updates the row optimistically.
 */
export async function updateCasePropertyFieldAction(
  caseId: string,
  propertyId: string,
  field: string,
  value: string | null,
): Promise<UpdateCasePropertyResult> {
  if (!isEditablePropertyField(field)) return { ok: false, error: 'invalid_field' };
  if (!(await userCanEditCase(caseId))) return { ok: false, error: 'unauthorized' };

  const supabase = await createClient();
  const { data: userRes } = await supabase.auth.getUser();
  if (!userRes.user) return { ok: false, error: 'unauthorized' };

  const { error } = await (supabase as unknown as UpdateClient)
    .from('case_properties')
    .update({ [field]: coerce(field, value), updated_by: userRes.user.id })
    .eq('id', propertyId)
    .eq('case_id', caseId)
    .is('deleted_at', null);

  if (error) {
    console.error('[update-case-property] error', error.message);
    return { ok: false, error: 'unknown' };
  }
  return { ok: true };
}
