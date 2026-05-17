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

export const CASE_BLOCKER_LABELS: Record<CaseBlocker, { he: string; color: string }> = {
  none: { he: 'לא מעוכב', color: '#10B981' },
  client: { he: 'לקוח', color: '#EC4899' },
  bank: { he: 'בנק', color: '#DC2626' },
  office: { he: 'משרד', color: '#F97316' },
  appraiser: { he: 'שמאי', color: '#EAB308' },
  lawyer: { he: 'עו״ד', color: '#A855F7' },
};

export const INSURANCE_STATUS_VALUES = ['exists', 'in_progress', 'missing'] as const;
export type InsuranceStatus = (typeof INSURANCE_STATUS_VALUES)[number];

export const INSURANCE_STATUS_LABELS: Record<InsuranceStatus, { he: string; color: string }> = {
  exists: { he: 'קיים', color: '#10B981' },
  in_progress: { he: 'בתהליך', color: '#EAB308' },
  missing: { he: 'לא קיים', color: '#DC2626' },
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
  request_details: optionalString,
});

export type CaseFormInput = z.infer<typeof CaseFormSchema>;
