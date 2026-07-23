import type { CaseExpenseRow } from '../types';

/**
 * Blank expense row for an optimistic insert — mirrors what
 * createEmptyExpenseAction persists (case_id + today's expense_date set, the rest
 * defaulted). created_at / updated_at are placeholders the next server resync
 * overwrites.
 */
export function emptyExpenseRow(id: string, caseId: string, expenseDate: string | null = null): CaseExpenseRow {
  return {
    id,
    case_id: caseId,
    amount: null,
    created_at: '',
    created_by: null,
    deleted_at: null,
    deleted_by: null,
    description: null,
    expense_date: expenseDate,
    receipt_drive_id: null,
    receipt_drive_url: null,
    receipt_mime: null,
    receipt_name: null,
    receipt_path: null,
    updated_at: '',
    updated_by: null,
  };
}
