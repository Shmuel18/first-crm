import { z } from 'zod';

import {
  CURRENCY_MAX_ILS,
  MONTHLY_AMOUNT_MAX_ILS,
  NAME_MAX,
  NOTES_MAX,
  optionalCurrency,
  optionalDate,
  optionalEmail,
  optionalIsraeliPhone,
  optionalNationalId,
  optionalNotes,
  optionalShortString,
  optionalUuid,
} from '@/lib/validators/form-primitives';

export const LeadFormSchema = z
  .object({
    first_name: z
      .string({ error: 'leads.errors.nameRequired' })
      .trim()
      .min(1, { error: 'leads.errors.nameRequired' })
      .max(NAME_MAX),
    last_name: optionalShortString(NAME_MAX),
    phone: optionalIsraeliPhone,
    email: optionalEmail,
    national_id: optionalNationalId,
    notes: optionalNotes(NOTES_MAX),
    assigned_to: optionalUuid,
    // Discovery-call fields (optional). Stored in leads.metadata.payload (intake
    // shape) so the details panel shows them and lead→case conversion imports them.
    purpose: optionalShortString(NAME_MAX),
    property_value: optionalCurrency(CURRENCY_MAX_ILS),
    requested_mortgage_amount: optionalCurrency(CURRENCY_MAX_ILS),
    equity: optionalCurrency(CURRENCY_MAX_ILS),
    monthly_income: optionalCurrency(MONTHLY_AMOUNT_MAX_ILS),
    follow_up_date: optionalDate,
  })
  .superRefine((data, ctx) => {
    // Same sanity check as the case + intake forms: the mortgage can't exceed the
    // property value.
    if (
      data.property_value != null &&
      data.requested_mortgage_amount != null &&
      data.requested_mortgage_amount > data.property_value
    ) {
      ctx.addIssue({
        code: 'custom',
        path: ['requested_mortgage_amount'],
        message: 'case.form.errors.mortgageExceedsProperty',
      });
    }
  });

export type LeadFormInput = z.infer<typeof LeadFormSchema>;
