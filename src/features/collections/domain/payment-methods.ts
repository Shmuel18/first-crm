/**
 * Closed set of fee-payment methods ("how paid"). Mirrors the CHECK constraint
 * on case_fee_payments.payment_method (migration 206) exactly — keep the two in
 * sync. Labels are i18n keys (collections.method.<value>), never hardcoded text.
 */
export const PAYMENT_METHODS = [
  'cash',
  'bank_transfer',
  'check',
  'credit_card',
  'bit',
  'other',
] as const;

export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export function isPaymentMethod(value: string): value is PaymentMethod {
  return (PAYMENT_METHODS as readonly string[]).includes(value);
}
