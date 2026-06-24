import type { PaymentMethod } from './domain/payment-methods';

export type { PaymentMethod };

/**
 * Raw row shape for public.case_fee_payments (migration 206). Declared locally
 * because the table lands in the generated Database types only after a types
 * regen — same untyped-handle pattern as case_payouts / case_properties.
 */
export type CaseFeePaymentRow = {
  id: string;
  case_id: string;
  paid_on: string | null;
  amount: number | null;
  payment_method: PaymentMethod | null;
  label: string | null;
  note: string | null;
  created_at: string;
  created_by: string | null;
  updated_at: string;
  updated_by: string | null;
  deleted_at: string | null;
  deleted_by: string | null;
};

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
  assignedAdvisorId: string | null;
  feeAmount: number | null;
  collected: number;
  expenses: number;
  paymentCount: number;
  lastPaymentOn: string | null;
};
