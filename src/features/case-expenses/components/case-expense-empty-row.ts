import type { CaseExpenseRow } from '../types';

/**
 * Blank expense row for an optimistic insert — mirrors what
 * createEmptyExpenseAction persists (only case_id set, the rest defaulted).
 * created_at / updated_at are placeholders the next server resync overwrites.
 */
export function emptyExpenseRow(id: string, caseId: string): CaseExpenseRow {
  return {
    id,
    case_id: caseId,
    amount: null,
    created_at: '',
    created_by: null,
    deleted_at: null,
    deleted_by: null,
    description: null,
    expense_date: null,
    receipt_drive_url: null,
    receipt_mime: null,
    receipt_name: null,
    receipt_path: null,
    updated_at: '',
    updated_by: null,
  };
}
