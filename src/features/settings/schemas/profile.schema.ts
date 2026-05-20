import { z } from 'zod';

import {
  NAME_MAX,
  optionalIsraeliPhone,
  optionalShortString,
} from '@/lib/validators/form-primitives';

export const ProfileFormSchema = z.object({
  first_name: optionalShortString(NAME_MAX),
  last_name: optionalShortString(NAME_MAX),
  phone: optionalIsraeliPhone,
  language: z.enum(['he', 'en']).default('he'),
});

export type ProfileFormInput = z.infer<typeof ProfileFormSchema>;
