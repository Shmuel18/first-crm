import { z } from 'zod';

import { NAME_MAX, optionalEmail, optionalShortString } from '@/lib/validators/form-primitives';

const emptyToNull = (v: unknown): unknown => (v === '' || v === null ? null : v);

export const OfficeFormSchema = z.object({
  office_name: z.preprocess(
    (v) => (typeof v === 'string' ? v.trim() : v),
    z
      .string({ error: 'common.errors.required' })
      .min(1, { error: 'common.errors.required' })
      .max(NAME_MAX, { error: 'common.errors.tooLarge' }),
  ),
  office_tagline: optionalShortString(NAME_MAX),
  address_street: optionalShortString(NAME_MAX),
  address_city: optionalShortString(NAME_MAX),
  address_postal_code: optionalShortString(20),
  phone_main: optionalShortString(40),
  phone_fax: optionalShortString(40),
  email_main: optionalEmail,
  website_url: z.preprocess(
    emptyToNull,
    z.url({ error: 'common.errors.invalidUrl' }).nullable().optional(),
  ),
  tax_id: optionalShortString(40),
  // Data-retention knobs (office_settings, NOT NULL ints). Coerced from the
  // form's string FormData; bounded so a typo can't wipe records or keep them
  // forever. Set per the office's legal retention obligations (LEGAL-4).
  audit_log_retention_days: z.coerce
    .number({ error: 'common.errors.required' })
    .int({ error: 'common.errors.required' })
    .min(30, { error: 'common.errors.tooSmall' })
    .max(3650, { error: 'common.errors.tooLarge' }),
  deleted_records_retention_days: z.coerce
    .number({ error: 'common.errors.required' })
    .int({ error: 'common.errors.required' })
    .min(1, { error: 'common.errors.tooSmall' })
    .max(3650, { error: 'common.errors.tooLarge' }),
});

export type OfficeFormInput = z.infer<typeof OfficeFormSchema>;
