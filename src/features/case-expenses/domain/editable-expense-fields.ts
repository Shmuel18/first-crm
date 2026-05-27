import { ExpenseFormShape } from '../schemas/expense.schema';

/**
 * Whitelist of case_expenses columns the inline-table can patch via
 * updateExpenseFieldAction. Same defence-in-depth pattern as the borrower
 * and case whitelists — keeps the per-field Zod validator picker honest.
 */
export const EDITABLE_EXPENSE_FIELDS = [
  'expense_date',
  'amount',
  'description',
] as const satisfies readonly (keyof typeof ExpenseFormShape.shape)[];

export type EditableExpenseField = (typeof EDITABLE_EXPENSE_FIELDS)[number];

export function isEditableExpenseField(field: string): field is EditableExpenseField {
  return (EDITABLE_EXPENSE_FIELDS as readonly string[]).includes(field);
}
