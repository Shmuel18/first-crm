import { z } from 'zod';

import {
  boolFromForm,
  CHILDREN_MAX,
  NAME_MAX,
  NOTES_MAX,
  optionalDate,
  optionalEmail,
  optionalEnum,
  optionalInt,
  optionalIsraeliId,
  optionalIsraeliPhone,
  optionalNotes,
  optionalPastDate,
  optionalShortString,
  requiredShortString,
} from '@/lib/validators/form-primitives';

export const MARITAL_STATUS_VALUES = [
  'single',
  'married',
  'divorced',
  'widowed',
  'common_law',
] as const;
export type MaritalStatus = (typeof MARITAL_STATUS_VALUES)[number];

export const RESIDENCY_TYPE_VALUES = [
  'resident',
  'foreign_resident',
  'returning_resident',
] as const;
export type ResidencyType = (typeof RESIDENCY_TYPE_VALUES)[number];

export const EMPLOYMENT_STATUS_VALUES = [
  'employee',
  'self_employed',
  'unemployed',
  'pensioner',
] as const;
export type EmploymentStatus = (typeof EMPLOYMENT_STATUS_VALUES)[number];

export const ROLE_IN_CASE_VALUES = ['borrower', 'guarantor'] as const;
export type RoleInCase = (typeof ROLE_IN_CASE_VALUES)[number];

export const PREFERRED_LANGUAGE_VALUES = ['he', 'en'] as const;
export type PreferredLanguage = (typeof PREFERRED_LANGUAGE_VALUES)[number];

export const GENDER_VALUES = ['male', 'female', 'other'] as const;
export type Gender = (typeof GENDER_VALUES)[number];

// 3-state "yes / no / unknown" coercion shared between owns_other_property and
// related_to_sellers — both come from the same <NativeSelect> shape where the
// empty option means "we don't know yet".
const tristateBool = z.preprocess((v) => {
  if (v === '' || v === null || v === undefined || v === 'unset') return null;
  if (v === true || v === 'true' || v === 'on') return true;
  if (v === false || v === 'false') return false;
  return v;
}, z.boolean().nullable().optional());

export const BorrowerFormSchema = z.object({
  // Both name parts are mandatory — the dashboard's A-Z sort uses the surname
  // as the primary key, and call-the-client UX leans on the first name. We'd
  // rather fail at save time than silently ship "(ללא שם)" rows.
  first_name: requiredShortString(NAME_MAX),
  last_name: requiredShortString(NAME_MAX),
  national_id: optionalIsraeliId,
  // ID issue date must be in the past — an Israeli ID can't have been issued
  // in the future. Same constraint as birth_date so we reuse the helper.
  id_issue_date: optionalPastDate,
  // Expiry, unlike issue, is FUTURE-dated. Use optionalDate (no past/future
  // constraint) — most banks reject already-expired IDs but we let advisors
  // record the expiry regardless so they see when it lapses.
  id_expiry_date: optionalDate,
  gender: optionalEnum(GENDER_VALUES),
  phone: optionalIsraeliPhone,
  landline_phone: optionalIsraeliPhone,
  email: optionalEmail,
  preferred_language: optionalEnum(PREFERRED_LANGUAGE_VALUES),
  birth_date: optionalPastDate,
  marital_status: optionalEnum(MARITAL_STATUS_VALUES),
  children_count: optionalInt(CHILDREN_MAX),
  // Free-text per borrower (POV). Examples the user will write: "נשואים",
  // "אחים", "הורה-ילד", "שותפים עסקיים". Capped like a short name field.
  relationship_in_case: optionalShortString(NAME_MAX),
  address: optionalShortString(NAME_MAX),
  city: optionalShortString(NAME_MAX),
  citizenship: optionalShortString(NAME_MAX),
  // Single ISO country code (or legacy free text) of the secondary citizenship
  // revealed by the "האם ישנן אזרחויות נוספות?" toggle on the borrower card.
  // Column name stays plural for backward-compat with existing rows.
  additional_citizenships: optionalShortString(NAME_MAX),
  residency_type: optionalEnum(RESIDENCY_TYPE_VALUES),
  // Country of foreign residence — revealed by the "האם תושב חוץ?" toggle.
  // Only meaningful when residency_type='foreign_resident'; the toggle keeps
  // those two columns in sync.
  foreign_residence_country: optionalShortString(NAME_MAX),
  employment_status: optionalEnum(EMPLOYMENT_STATUS_VALUES),
  employer_name: optionalShortString(NAME_MAX),
  credit_rating: optionalShortString(64),
  owns_other_property: tristateBool,
  related_to_sellers: tristateBool,
  notes: optionalNotes(NOTES_MAX),
  // Junction-table fields - required by the action.
  role_in_case: z
    .enum(ROLE_IN_CASE_VALUES, { error: 'common.errors.invalidEnum' })
    .default('borrower'),
  is_primary: boolFromForm,
});

export type BorrowerFormInput = z.infer<typeof BorrowerFormSchema>;
