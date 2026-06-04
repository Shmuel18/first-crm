import { createClient } from '@/lib/supabase/server';
import type { CaseId } from '@/lib/types/branded';

import type { CaseExpenseRow } from '../types';

// Explicit column list — schema additions surface here as a deliberate step,
// not auto-flow to the client. Mirrors the cases / obligations services.
const EXPENSE_FULL_COLUMNS =
  'id, case_id, expense_date, amount, description, receipt_path, receipt_name, receipt_mime, receipt_drive_url, receipt_drive_id, created_at, created_by, updated_at, updated_by, deleted_at, deleted_by' as const;

/**
 * Lists active (non-soft-deleted) expenses for a case, ordered by date
 * descending (most recent first) with a stable created_at tie-break for
 * rows that share a date.
 */
export async function listCaseExpenses(caseId: CaseId): Promise<CaseExpenseRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('case_expenses')
    .select(EXPENSE_FULL_COLUMNS)
    .eq('case_id', caseId)
    .is('deleted_at', null)
    .order('expense_date', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false });

  if (error) {
    console.error(
      '[listCaseExpenses] select error',
      JSON.stringify({
        caseId,
        code: error.code ?? null,
        message: error.message ?? null,
      }),
    );
    return [];
  }
  return (data ?? []) as CaseExpenseRow[];
}
