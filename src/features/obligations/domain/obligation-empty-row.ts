import type { ObligationRow } from '../types';

/**
 * Blank obligation row for an optimistic insert — mirrors what
 * createEmptyObligationAction persists (only borrower_id set, the rest
 * defaulted). created_at / updated_at are placeholders the next server resync
 * overwrites.
 */
export function emptyObligationRow(id: string, borrowerId: string): ObligationRow {
  return {
    id,
    borrower_id: borrowerId,
    created_at: '',
    created_by: null,
    deleted_at: null,
    deleted_by: null,
    description: null,
    end_date: null,
    lender: null,
    loan_amount: null,
    metadata: {},
    monthly_payment: null,
    months_remaining: null,
    updated_at: '',
    updated_by: null,
  };
}
