import { z } from 'zod';

import {
  EMPLOYMENT_STATUS_VALUES,
  GENDER_VALUES,
  MARITAL_STATUS_VALUES,
  PREFERRED_LANGUAGE_VALUES,
  RESIDENCY_TYPE_VALUES,
} from '@/features/borrowers/schemas/borrower.schema';
import {
  CHILDREN_MAX,
  CURRENCY_MAX_ILS,
  MONTHLY_AMOUNT_MAX_ILS,
  NAME_MAX,
  optionalCurrency,
  optionalDate,
  optionalEmail,
  optionalEnum,
  optionalInt,
  optionalIsraeliPhone,
  optionalLongText,
  optionalNationalId,
  optionalPastDate,
  optionalShortString,
  REQUEST_DETAILS_MAX,
  requiredEmail,
  requiredShortString,
} from '@/lib/validators/form-primitives';

/**
 * A public prospect can list at most this many borrowers. Bounds the anon
 * payload and mirrors the RPC guard in migration 151. Kept small on purpose —
 * staff add edge-case parties (guarantors etc.) after conversion.
 */
export const MAX_INTAKE_BORROWERS = 4;

/**
 * Per-borrower slice of the questionnaire. Field names mirror the borrower card
 * (borrower.schema.ts) so conversion maps 1:1; this is a CLIENT-FACING subset —
 * staff-only fields (credit_rating, id dates, etc.) are intentionally absent.
 * Income fields (step 4) live here too because they are per borrower.
 */
export const IntakeBorrowerSchema = z.object({
  first_name: requiredShortString(NAME_MAX),
  last_name: requiredShortString(NAME_MAX),
  national_id: optionalNationalId,
  birth_date: optionalPastDate,
  gender: optionalEnum(GENDER_VALUES),
  marital_status: optionalEnum(MARITAL_STATUS_VALUES),
  children_count: optionalInt(CHILDREN_MAX),
  phone: optionalIsraeliPhone,
  email: optionalEmail,
  preferred_language: optionalEnum(PREFERRED_LANGUAGE_VALUES),
  address: optionalShortString(NAME_MAX),
  city: optionalShortString(NAME_MAX),
  citizenship: optionalShortString(NAME_MAX),
  residency_type: optionalEnum(RESIDENCY_TYPE_VALUES),
  foreign_residence_country: optionalShortString(NAME_MAX),
  related_to_sellers: z.boolean().nullish(),
  // Step 4 — income.
  employment_status: optionalEnum(EMPLOYMENT_STATUS_VALUES),
  employer_name: optionalShortString(NAME_MAX),
  monthly_income: optionalCurrency(MONTHLY_AMOUNT_MAX_ILS),
  employment_start_date: optionalDate,
});

export type IntakeBorrowerInput = z.infer<typeof IntakeBorrowerSchema>;

export const IntakeSchema = z
  .object({
    // Step 1 — composition. `purpose` is free text (the internal case_type is a
    // lookup the prospect can't pick; staff map it on conversion).
    purpose: optionalShortString(NAME_MAX),
    property_city: optionalShortString(NAME_MAX),
    // Step 3 — property.
    property_value: optionalCurrency(CURRENCY_MAX_ILS),
    requested_mortgage_amount: optionalCurrency(CURRENCY_MAX_ILS),
    equity: optionalCurrency(CURRENCY_MAX_ILS),
    owns_other_property: z.boolean().nullish(),
    // Step 2 + 4 — one entry per borrower.
    borrowers: z.array(IntakeBorrowerSchema).min(1).max(MAX_INTAKE_BORROWERS),
    // Step 5 — the prospect's story.
    request_details: optionalLongText(REQUEST_DETAILS_MAX),
    // UI language the form was filled in (he/en) — recorded for the callback.
    locale: optionalEnum(PREFERRED_LANGUAGE_VALUES),
    // Privacy consent — must be explicitly checked.
    consent: z.literal(true, { error: 'intake.errors.consentRequired' }),
  })
  .superRefine((data, ctx) => {
    // The office must be able to reach the prospect — require a phone or email
    // on the primary (first) borrower.
    const primary = data.borrowers[0];
    if (primary && !primary.phone && !primary.email) {
      ctx.addIssue({
        code: 'custom',
        path: ['borrowers', 0, 'phone'],
        message: 'intake.errors.contactRequired',
      });
    }
    // Same cross-field sanity check the case form uses: mortgage <= value.
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

export type IntakeInput = z.infer<typeof IntakeSchema>;

/**
 * Landing-page contact form (kaufman-finance.com) → web lead. A far lighter
 * shape than the full questionnaire — just who they are and what they want. The
 * /api/web-lead route maps this onto an IntakeInput (one borrower) and writes it
 * through the same createIntakeLead path. Reuses the shared primitives so the
 * email is validated + normalized and free text is sanitized + length-capped;
 * the RPC re-validates server-side as the authoritative backstop.
 */
export const WebContactSchema = z.object({
  name: requiredShortString(NAME_MAX),
  email: requiredEmail,
  subject: optionalShortString(200),
  message: optionalLongText(4000),
  locale: z.enum(['he', 'en']).default('en'),
});

export type WebContactInput = z.infer<typeof WebContactSchema>;
