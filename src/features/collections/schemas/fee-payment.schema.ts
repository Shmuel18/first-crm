import { z } from 'zod';

import { CURRENCY_MAX_ILS, NAME_MAX, SHORT_NOTE_MAX } from '@/lib/validators/form-primitives';

import { PAYMENT_METHODS } from '../domain/payment-methods';

/**
 * Single source of truth for the add-payment form (client) + action (server).
 * amount is required & positive — a ledger row with no money makes no sense
 * (unlike the inline blank-row tables elsewhere). paidOn / method / label are
 * optional so a quick "₪5,000 came in" entry is one field.
 */
export const AddFeePaymentSchema = z.object({
  caseId: z.uuid(),
  paidOn: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'invalid_date')
    .nullish(),
  amount: z.number().positive().max(CURRENCY_MAX_ILS),
  paymentMethod: z.enum(PAYMENT_METHODS).nullish(),
  label: z.string().trim().max(NAME_MAX).nullish(),
  note: z.string().trim().max(SHORT_NOTE_MAX).nullish(),
});

export type AddFeePaymentInput = z.infer<typeof AddFeePaymentSchema>;
