import { z } from 'zod';

import { NAME_MAX, optionalShortString } from '@/lib/validators/form-primitives';

import { TEMPLATE_CHANNELS } from '../types';

const BODY_MAX = 4000;

export const TemplateFormSchema = z.object({
  name: z
    .string({ error: 'common.errors.required' })
    .trim()
    .min(1, { error: 'common.errors.required' })
    .max(NAME_MAX),
  channel: z.preprocess(
    (v) => (v === '' || v === null ? undefined : v),
    z.enum(TEMPLATE_CHANNELS, { error: 'common.errors.invalidEnum' }).default('whatsapp'),
  ),
  subject: optionalShortString(200),
  body: z
    .string({ error: 'common.errors.required' })
    .trim()
    .min(1, { error: 'common.errors.required' })
    .max(BODY_MAX, { error: 'common.errors.tooLarge' }),
});

export type TemplateFormInput = z.infer<typeof TemplateFormSchema>;
