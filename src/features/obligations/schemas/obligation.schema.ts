import { z } from 'zod';

import {
  CURRENCY_MAX_ILS,
  MONTHLY_AMOUNT_MAX_ILS,
  NAME_MAX,
  NOTES_MAX,
  optionalCurrency,
  optionalDate,
  optionalInt,
  optionalNotes,
  optionalShortString,
  requiredUuid,
} from '@/lib/validators/form-primitives';

export const ObligationFormSchema = z.object({
  borrower_id: requiredUuid('obligations.errors.borrowerRequired'),
  loan_amount: optionalCurrency(CURRENCY_MAX_ILS),
  monthly_payment: optionalCurrency(MONTHLY_AMOUNT_MAX_ILS),
  months_remaining: optionalInt(600), // 50-year cap
  end_date: optionalDate,
  lender: optionalShortString(NAME_MAX),
  description: optionalNotes(NOTES_MAX),
});

export type ObligationFormInput = z.infer<typeof ObligationFormSchema>;
