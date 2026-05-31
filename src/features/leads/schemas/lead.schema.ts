import { z } from 'zod';

import {
  NAME_MAX,
  NOTES_MAX,
  optionalEmail,
  optionalIsraeliPhone,
  optionalNationalId,
  optionalNotes,
  optionalShortString,
  optionalUuid,
} from '@/lib/validators/form-primitives';

export const LeadFormSchema = z.object({
  first_name: z
    .string({ error: 'leads.errors.nameRequired' })
    .trim()
    .min(1, { error: 'leads.errors.nameRequired' })
    .max(NAME_MAX),
  last_name: optionalShortString(NAME_MAX),
  phone: optionalIsraeliPhone,
  email: optionalEmail,
  national_id: optionalNationalId,
  notes: optionalNotes(NOTES_MAX),
  assigned_to: optionalUuid,
});

export type LeadFormInput = z.infer<typeof LeadFormSchema>;
