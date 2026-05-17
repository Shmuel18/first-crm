import { z } from 'zod';

const optionalString = z.preprocess(
  (v) => (v === '' || v === null ? undefined : v),
  z.string().optional(),
);

const optionalUuid = z.preprocess(
  (v) => (v === '' || v === null ? undefined : v),
  z.string().uuid().optional(),
);

const optionalDate = z.preprocess(
  (v) => (v === '' || v === null ? undefined : v),
  z.string().optional(),
);

const boolFromForm = z.preprocess((v) => v === 'on' || v === 'true' || v === true, z.boolean());

export const CaseBankFormSchema = z.object({
  bank_id: z.string().uuid({ message: 'יש לבחור בנק' }),
  bank_status_id: optionalUuid,
  is_primary: boolFromForm,
  banker_name: optionalString,
  banker_phone: optionalString,
  banker_email: z.preprocess(
    (v) => (v === '' || v === null ? undefined : v),
    z.string().email({ message: 'אימייל לא תקין' }).optional(),
  ),
  submission_date: optionalDate,
  response_date: optionalDate,
  notes: optionalString,
});

export type CaseBankFormInput = z.infer<typeof CaseBankFormSchema>;
