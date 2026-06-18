import { z } from 'zod';

import {
  CURRENCY_MAX_ILS,
  MONTHLY_AMOUNT_MAX_ILS,
  NAME_MAX,
  optionalCurrency,
  optionalDate,
  optionalEnum,
  optionalLongText,
  optionalShortString,
  optionalUuid,
  REQUEST_DETAILS_MAX,
  SHORT_NOTE_MAX,
} from '@/lib/validators/form-primitives';

export const CASE_BLOCKER_VALUES = ['none', 'client', 'bank', 'office', 'appraiser', 'lawyer'] as const;
export type CaseBlocker = (typeof CASE_BLOCKER_VALUES)[number];

export const INSURANCE_STATUS_VALUES = ['exists', 'in_progress', 'missing'] as const;
export type InsuranceStatus = (typeof INSURANCE_STATUS_VALUES)[number];

/**
 * Exposed separately so inline-edit actions can pick a single-field
 * validator by name (`CaseFormShape.shape[fieldName]`). The full form
 * uses CaseFormSchema (this object + a superRefine for cross-field rules).
 */
export const CaseFormShape = z.object({
  case_type_primary_id: optionalUuid,
  case_type_secondary_id: optionalUuid,
  status_id: optionalUuid,
  assigned_advisor_id: optionalUuid,
  case_blocker: optionalEnum(CASE_BLOCKER_VALUES),
  insurance_status: optionalEnum(INSURANCE_STATUS_VALUES),
  insurance_agent_name: optionalShortString(NAME_MAX),
  appraiser_name: optionalShortString(NAME_MAX),
  referrer_name: optionalShortString(NAME_MAX),
  property_value: optionalCurrency(CURRENCY_MAX_ILS),
  requested_mortgage_amount: optionalCurrency(CURRENCY_MAX_ILS),
  equity: optionalCurrency(CURRENCY_MAX_ILS),
  fee_amount: optionalCurrency(MONTHLY_AMOUNT_MAX_ILS),
  city: optionalShortString(NAME_MAX),
  gush_helka: optionalShortString(NAME_MAX),
  case_type_other_text: optionalShortString(NAME_MAX),
  short_note: optionalShortString(SHORT_NOTE_MAX),
  target_date: optionalDate,
  request_details: optionalLongText(REQUEST_DETAILS_MAX),
});

export const CaseFormSchema = CaseFormShape
  .superRefine((data, ctx) => {
    // Cross-field sanity check: mortgage ≤ property value. If both are
    // provided and the relationship is broken, reject with a translated
    // error on the mortgage field (where the user is likely typing).
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

export type CaseFormInput = z.infer<typeof CaseFormSchema>;
