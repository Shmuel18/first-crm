'use server';

import type { SupabaseClient } from '@supabase/supabase-js';

import { userHasPermission } from '@/lib/auth/permissions';
import { createClient } from '@/lib/supabase/server';
import { resolveSchemaErrors } from '@/lib/validators/i18n-errors';

import { isEditablePayoutField, type EditablePayoutField } from '../domain/editable-payout-fields';
import { PayoutFormShape } from '../schemas/payout.schema';

export type { EditablePayoutField } from '../domain/editable-payout-fields';

export type UpdatePayoutFieldResult =
  | { ok: true }
  | { ok: false; error: 'invalid_field' | 'validation' | 'unauthorized' | 'unknown'; message?: string };

/**
 * Patches a single case_payouts cell (recipient / amount). Manager-only —
 * `view_case_fee` gate + RLS is_admin(). Whitelist + per-field Zod validator,
 * mirroring updateExpenseFieldAction.
 */
export async function updatePayoutFieldAction(
  payoutId: string,
  caseId: string,
  field: string,
  rawValue: unknown,
): Promise<UpdatePayoutFieldResult> {
  if (!isEditablePayoutField(field)) return { ok: false, error: 'invalid_field' };
  const safeField: EditablePayoutField = field;

  const parsed = PayoutFormShape.shape[safeField].safeParse(rawValue);
  if (!parsed.success) {
    const fieldErrors = await resolveSchemaErrors(parsed.error);
    return { ok: false, error: 'validation', message: fieldErrors[safeField] ?? Object.values(fieldErrors)[0] };
  }

  if (!(await userHasPermission('view_case_fee'))) return { ok: false, error: 'unauthorized' };

  const supabase = await createClient();
  const { data: userRes } = await supabase.auth.getUser();
  if (!userRes.user) return { ok: false, error: 'unauthorized' };

  const db = supabase as unknown as SupabaseClient;
  const { data: updated, error } = await db
    .from('case_payouts')
    .update({ [safeField]: parsed.data ?? null, updated_by: userRes.user.id })
    .eq('id', payoutId)
    .eq('case_id', caseId)
    .is('deleted_at', null)
    .select('id');

  if (error) {
    console.error('[updatePayoutField] update error', error.code);
    return { ok: false, error: 'unknown' };
  }
  // 0 rows matched (bad id / soft-deleted / RLS) is a silent no-op in
  // PostgREST — without this check the client reports "saved" unwritten.
  if (!updated || updated.length === 0) {
    console.error('[updatePayoutField] no row matched', JSON.stringify({ payoutId, caseId }));
    return { ok: false, error: 'unauthorized' };
  }
  return { ok: true };
}
