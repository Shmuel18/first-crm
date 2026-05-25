import type { Database } from '@/types/database';

export type ObligationRow = Database['public']['Tables']['borrower_obligations']['Row'];
export type ObligationInsert = Database['public']['Tables']['borrower_obligations']['Insert'];

/** Obligations grouped by their owning borrower, for display on a case page. */
export type BorrowerObligationsGroup = {
  borrowerId: string;
  borrowerName: string;
  obligations: ObligationRow[];
  monthlyPaymentTotal: number;
  remainingDebtTotal: number;
};

export type ObligationActionState =
  | { ok: true; obligationId: string }
  | {
      ok: false;
      error: 'validation' | 'unauthorized' | 'unknown';
      fieldErrors?: Record<string, string>;
      values?: Partial<Record<string, string>>;
    }
  | { ok: false; error: 'idle' };

export const OBLIGATION_ACTION_INITIAL: ObligationActionState = { ok: false, error: 'idle' };
