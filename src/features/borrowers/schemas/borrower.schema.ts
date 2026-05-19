import { z } from 'zod';

import {
  boolFromForm,
  CHILDREN_MAX,
  NAME_MAX,
  NOTES_MAX,
  optionalEmail,
  optionalEnum,
  optionalInt,
  optionalIsraeliId,
  optionalIsraeliPhone,
  optionalNotes,
  optionalPastDate,
  optionalShortString,
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

export const BorrowerFormSchema = z.object({
  first_name: optionalShortString(NAME_MAX),
  last_name: optionalShortString(NAME_MAX),
  national_id: optionalIsraeliId,
  phone: optionalIsraeliPhone,
  email: optionalEmail,
  birth_date: optionalPastDate,
  marital_status: optionalEnum(MARITAL_STATUS_VALUES),
  children_count: optionalInt(CHILDREN_MAX),
  address: optionalShortString(NAME_MAX),
  citizenship: optionalShortString(NAME_MAX),
  residency_type: optionalEnum(RESIDENCY_TYPE_VALUES),
  employment_status: optionalEnum(EMPLOYMENT_STATUS_VALUES),
  employer_name: optionalShortString(NAME_MAX),
  credit_rating: optionalShortString(64),
  owns_other_property: z.preprocess((v) => {
    if (v === '' || v === null || v === undefined || v === 'unset') return null;
    if (v === true || v === 'true' || v === 'on') return true;
    if (v === false || v === 'false') return false;
    return v;
  }, z.boolean().nullable().optional()),
  notes: optionalNotes(NOTES_MAX),
  // Junction-table fields - required by the action.
  role_in_case: z
    .enum(ROLE_IN_CASE_VALUES, { error: 'common.errors.invalidEnum' })
    .default('borrower'),
  is_primary: boolFromForm,
});

export type BorrowerFormInput = z.infer<typeof BorrowerFormSchema>;
