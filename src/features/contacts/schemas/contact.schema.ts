import { z } from 'zod';

import { requiredShortString } from '@/lib/validators/form-primitives';

import { CONTACT_KINDS } from '../types';

const optionalText = (max: number) =>
  z.preprocess(
    (v) => (typeof v === 'string' && v.trim() === '' ? null : v),
    z.string().trim().max(max).nullable().optional(),
  );

export const ContactFormSchema = z.object({
  kind: z.enum(CONTACT_KINDS, { error: 'common.errors.invalidEnum' }),
  name: requiredShortString(120),
  phone: optionalText(40),
  whatsapp: optionalText(40),
  email: z.preprocess(
    (v) => (typeof v === 'string' && v.trim() === '' ? null : v),
    z.email({ error: 'common.errors.invalidEmail' }).max(254).nullable().optional(),
  ),
  company: optionalText(120),
  notes: optionalText(1000),
});

export type ContactFormInput = z.infer<typeof ContactFormSchema>;

export type ContactActionState =
  | { ok: true }
  | {
      ok: false;
      error: 'idle' | 'validation' | 'unauthorized' | 'unknown';
      fieldErrors?: Record<string, string>;
      values?: Partial<Record<string, string>>;
    };

export const CONTACT_ACTION_INITIAL: ContactActionState = { ok: false, error: 'idle' };
