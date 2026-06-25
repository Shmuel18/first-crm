import type { PaymentMethod } from './domain/payment-methods';

export type { PaymentMethod };

/** One fee payment in a case's collection ledger (money in ₪). */
export type FeePayment = {
  id: string;
  caseId: string;
  paidOn: string | null; // YYYY-MM-DD
  amount: number;
  paymentMethod: PaymentMethod | null;
  label: string | null;
  note: string | null;
};

/** Collection progress of a single case's agreed fee. */
export type CollectionStatus = 'not_started' | 'partial' | 'collected' | 'overpaid';

/** One row of the global /collections dashboard — output of collections_overview(). */
export type CollectionOverviewRow = {
  caseId: string;
  caseNumber: string;
  /** All borrowers on the case, primary first, comma-joined (null if none). */
  borrowers: string | null;
  feeAmount: number | null;
  collected: number;
  expenses: number;
  paymentCount: number;
  lastPaymentOn: string | null;
};
