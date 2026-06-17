import type { CasePayoutRow } from '../types';

/** Blank payout row for an optimistic insert — mirrors what
 *  createEmptyPayoutAction persists (only case_id set, the rest defaulted). */
export function emptyPayoutRow(id: string, caseId: string): CasePayoutRow {
  return {
    id,
    case_id: caseId,
    recipient: null,
    amount: null,
    created_at: '',
    created_by: null,
    updated_at: '',
    updated_by: null,
    deleted_at: null,
    deleted_by: null,
  };
}
