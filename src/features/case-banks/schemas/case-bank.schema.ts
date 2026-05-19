import { z } from 'zod';

import {
  boolFromForm,
  NAME_MAX,
  NOTES_MAX,
  optionalDate,
  optionalEmail,
  optionalIsraeliPhone,
  optionalNotes,
  optionalShortString,
  optionalUuid,
  requiredUuid,
} from '@/lib/validators/form-primitives';

export const CaseBankFormSchema = z.object({
  bank_id: requiredUuid('caseBank.errors.bankRequired'),
  bank_status_id: optionalUuid,
  is_primary: boolFromForm,
  banker_name: optionalShortString(NAME_MAX),
  banker_phone: optionalIsraeliPhone,
  banker_email: optionalEmail,
  submission_date: optionalDate,
  response_date: optionalDate,
  notes: optionalNotes(NOTES_MAX),
});

export type CaseBankFormInput = z.infer<typeof CaseBankFormSchema>;
