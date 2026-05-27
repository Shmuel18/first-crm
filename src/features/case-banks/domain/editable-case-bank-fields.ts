import { CaseBankFormSchema } from '../schemas/case-bank.schema';

/**
 * Whitelist of case_banks columns the inline list on the admin block is
 * allowed to patch. Defence-in-depth against a manipulated request asking
 * us to update id / created_by / deleted_at.
 *
 * is_primary is intentionally NOT in this list — promotion goes through
 * setPrimaryBankAction → set_primary_bank RPC so the trigger that demotes
 * other primaries can run atomically.
 */
export const EDITABLE_CASE_BANK_FIELDS = [
  'bank_id',
  'banker_name',
  'banker_phone',
  'banker_email',
] as const satisfies readonly (keyof typeof CaseBankFormSchema.shape)[];

export type EditableCaseBankField = (typeof EDITABLE_CASE_BANK_FIELDS)[number];

export function isEditableCaseBankField(field: string): field is EditableCaseBankField {
  return (EDITABLE_CASE_BANK_FIELDS as readonly string[]).includes(field);
}
