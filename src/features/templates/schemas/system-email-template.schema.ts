import { z } from 'zod';

import { SYSTEM_EMAIL_TEMPLATE_KEYS } from '../domain/system-email-templates';

export const SystemEmailTemplateFormSchema = z.object({
  template_key: z.enum(SYSTEM_EMAIL_TEMPLATE_KEYS),
  locale: z.enum(['he', 'en']),
  subject: z.string().trim().min(1).max(240),
  heading: z.string().trim().min(1).max(240),
  body: z.string().trim().min(1).max(6000),
  cta_label: z.string().trim().min(1).max(120),
  is_enabled: z.preprocess((value) => value === 'true' || value === true, z.boolean()),
});

