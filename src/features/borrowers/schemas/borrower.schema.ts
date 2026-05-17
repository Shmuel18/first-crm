import { z } from 'zod';

const optionalString = z.preprocess(
  (v) => (v === '' || v === null ? undefined : v),
  z.string().optional(),
);

const optionalDate = z.preprocess(
  (v) => (v === '' || v === null ? undefined : v),
  z.string().optional(),
);

const optionalInt = z.preprocess((v) => {
  if (v === '' || v === null || v === undefined) return undefined;
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : undefined;
}, z.number().int().min(0).optional());

const optionalBool = z.preprocess((v) => {
  if (v === '' || v === null || v === undefined || v === 'unset') return undefined;
  if (v === 'true' || v === 'on') return true;
  if (v === 'false') return false;
  return undefined;
}, z.boolean().optional());

export const BorrowerFormSchema = z.object({
  first_name: optionalString,
  last_name: optionalString,
  national_id: optionalString,
  phone: optionalString,
  email: z.preprocess(
    (v) => (v === '' || v === null ? undefined : v),
    z.string().email({ message: 'אימייל לא תקין' }).optional(),
  ),
  birth_date: optionalDate,
  marital_status: z.preprocess(
    (v) => (v === '' || v === null ? undefined : v),
    z
      .enum(['single', 'married', 'divorced', 'widowed', 'common_law'])
      .optional(),
  ),
  children_count: optionalInt,
  address: optionalString,
  citizenship: optionalString,
  residency_type: z.preprocess(
    (v) => (v === '' || v === null ? undefined : v),
    z.enum(['resident', 'foreign_resident', 'returning_resident']).optional(),
  ),
  employment_status: z.preprocess(
    (v) => (v === '' || v === null ? undefined : v),
    z.enum(['employee', 'self_employed', 'unemployed', 'pensioner']).optional(),
  ),
  employer_name: optionalString,
  credit_rating: optionalString,
  owns_other_property: optionalBool,
  notes: optionalString,
  // Junction-table fields:
  role_in_case: z
    .enum(['borrower', 'guarantor'], { message: 'יש לבחור תפקיד' })
    .default('borrower'),
  is_primary: z.preprocess((v) => v === 'on' || v === 'true' || v === true, z.boolean()),
});

export type BorrowerFormInput = z.infer<typeof BorrowerFormSchema>;
