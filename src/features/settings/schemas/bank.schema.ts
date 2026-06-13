import { z } from 'zod';

import { requiredShortString } from '@/lib/validators/form-primitives';

export const LENDER_TYPES = ['bank', 'non_bank_lender'] as const;
export type LenderType = (typeof LENDER_TYPES)[number];

const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;

export const BankFormSchema = z.object({
  name_he: requiredShortString(120),
  name_en: requiredShortString(120),
  lender_type: z.enum(LENDER_TYPES, { error: 'common.errors.invalidEnum' }),
  color: z
    .string({ error: 'common.errors.required' })
    .trim()
    .regex(HEX_COLOR, { error: 'common.errors.invalidColor' }),
  logo_url: z.preprocess(
    (v) => (v === '' || v === null ? null : v),
    z
      .string()
      .max(2048)
      // Logos come from the public bank-logos bucket (https). Refuse other
      // schemes so a pasted javascript:/data: URL can never reach an img src.
      .regex(/^https:\/\//, { error: 'common.errors.invalidUrl' })
      .nullable()
      .optional(),
  ),
  is_active: z.preprocess((v) => v === 'true' || v === true || v === 'on', z.boolean()),
});

export type BankFormInput = z.infer<typeof BankFormSchema>;

export type BankActionState =
  | { ok: true; bankId: string }
  | {
      ok: false;
      error: 'idle' | 'validation' | 'unauthorized' | 'not_found' | 'unknown';
      fieldErrors?: Record<string, string>;
      values?: Partial<Record<string, string>>;
    };

export const BANK_ACTION_INITIAL: BankActionState = { ok: false, error: 'idle' };
