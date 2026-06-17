import { PayoutFormShape } from '../schemas/payout.schema';

/**
 * Whitelist of case_payouts columns the inline table can patch via
 * updatePayoutFieldAction — same defence-in-depth pattern as the expenses /
 * borrower whitelists (keeps the per-field Zod validator picker honest).
 */
export const EDITABLE_PAYOUT_FIELDS = [
  'recipient',
  'amount',
] as const satisfies readonly (keyof typeof PayoutFormShape.shape)[];

export type EditablePayoutField = (typeof EDITABLE_PAYOUT_FIELDS)[number];

export function isEditablePayoutField(field: string): field is EditablePayoutField {
  return (EDITABLE_PAYOUT_FIELDS as readonly string[]).includes(field);
}
