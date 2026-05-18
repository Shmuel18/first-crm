import { z } from 'zod';

/**
 * Form fields come as strings from FormData. Empty fields arrive as "".
 * We preprocess "" → undefined, then validate the inner schema (which is optional,
 * so undefined is accepted). `.optional()` MUST be on the inner schema -
 * if it's on the outer preprocess result, the inner schema still fails on undefined.
 */

const optionalString = z.preprocess(
  (v) => (v === '' || v === null ? undefined : v),
  z.string().optional(),
);

/**
 * request_details is rich HTML from Tiptap - sanitized at write time but
 * still capped to prevent DoS via megabyte-sized pastes (sanitize cost +
 * render cost on every case-detail load).
 */
const REQUEST_DETAILS_MAX = 50_000;
const optionalLongText = z.preprocess(
  (v) => (v === '' || v === null ? undefined : v),
  z.string().max(REQUEST_DETAILS_MAX).optional(),
);

const optionalUuid = z.preprocess(
  (v) => (v === '' || v === null ? undefined : v),
  z.string().uuid().optional(),
);

const optionalNumber = z.preprocess((v) => {
  if (v === '' || v === null || v === undefined) return undefined;
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : undefined;
}, z.number().min(0).optional());

const optionalEnum = <T extends readonly [string, ...string[]]>(values: T) =>
  z.preprocess(
    (v) => (v === '' || v === null ? undefined : v),
    z.enum(values as unknown as [string, ...string[]]).optional(),
  );

export const CASE_BLOCKER_VALUES = ['none', 'client', 'bank', 'office', 'appraiser', 'lawyer'] as const;
export type CaseBlocker = (typeof CASE_BLOCKER_VALUES)[number];

// Color per blocker - display labels come from i18n (case.blocker.<value>)
export const CASE_BLOCKER_COLORS: Record<CaseBlocker, string> = {
  none: '#10B981',
  client: '#EC4899',
  bank: '#DC2626',
  office: '#F97316',
  appraiser: '#EAB308',
  lawyer: '#A855F7',
};

export const INSURANCE_STATUS_VALUES = ['exists', 'in_progress', 'missing'] as const;
export type InsuranceStatus = (typeof INSURANCE_STATUS_VALUES)[number];

// Color per insurance status - display labels come from i18n (case.insurance.<value>)
export const INSURANCE_STATUS_COLORS: Record<InsuranceStatus, string> = {
  exists: '#10B981',
  in_progress: '#EAB308',
  missing: '#DC2626',
};

export const CaseFormSchema = z.object({
  case_type_primary_id: optionalUuid,
  case_type_secondary_id: optionalUuid,
  status_id: optionalUuid,
  assigned_advisor_id: optionalUuid,
  case_blocker: optionalEnum(CASE_BLOCKER_VALUES),
  insurance_status: optionalEnum(INSURANCE_STATUS_VALUES),
  referrer_name: optionalString,
  property_value: optionalNumber,
  requested_mortgage_amount: optionalNumber,
  equity: optionalNumber,
  fee_amount: optionalNumber,
  expected_income: optionalNumber,
  short_note: optionalString,
  request_details: optionalLongText,
});

export type CaseFormInput = z.infer<typeof CaseFormSchema>;
