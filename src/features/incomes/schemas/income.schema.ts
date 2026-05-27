import { z } from 'zod';

import {
  boolFromForm,
  MONTHLY_AMOUNT_MAX_ILS,
  NAME_MAX,
  NOTES_MAX,
  optionalCurrency,
  optionalDate,
  optionalInt,
  optionalNotes,
  optionalShortString,
  optionalUuid,
  requiredUuid,
} from '@/lib/validators/form-primitives';

export const IncomeFormSchema = z.object({
  // The borrower must already exist on the case — the action re-checks
  // that the caller can edit that case, so this is just shape validation.
  borrower_id: requiredUuid('incomes.errors.borrowerRequired'),
  // Income type is optional in DB so the row can be created mid-conversation
  // and categorised later. We surface the empty option as "(select)".
  income_type_id: optionalUuid,
  amount_monthly: optionalCurrency(MONTHLY_AMOUNT_MAX_ILS),
  source_name: optionalShortString(NAME_MAX),
  // Seniority used to be entered as a raw months number; UI now collects the
  // employment_start_date and derives months for display. Keep tenure_months
  // in the schema for back-compat with restored rows + the full-form save.
  tenure_months: optionalInt(600), // 50 years cap
  employment_start_date: optionalDate,
  is_primary: boolFromForm,
  notes: optionalNotes(NOTES_MAX),
});

export type IncomeFormInput = z.infer<typeof IncomeFormSchema>;
