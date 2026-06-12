import { z } from 'zod';

import {
  NAME_MAX,
  SHORT_NOTE_MAX,
  optionalEmail,
  optionalIsraeliPhone,
  optionalNationalId,
  optionalNotes,
  optionalShortString,
} from '@/lib/validators/form-primitives';

/**
 * Per-row validation for the bulk case import — the SAME shared primitives the
 * manual forms use (R3-import-1: the import previously persisted raw values,
 * breaking the canonical-phone / lowercase-email invariants that
 * returning-client detection and wa.me/tel links rely on).
 *
 * Normalization matters as much as validation here: optionalIsraeliPhone
 * canonicalizes Israeli numbers to 0XXXXXXXXX and optionalEmail lowercases —
 * the action persists the PARSED output, not the raw cell.
 */
export const ImportRowSchema = z.object({
  first_name: optionalShortString(NAME_MAX),
  last_name: optionalShortString(NAME_MAX),
  national_id: optionalNationalId,
  phone: optionalIsraeliPhone,
  email: optionalEmail,
  status: optionalShortString(80),
  advisor_email: optionalEmail,
  short_note: optionalNotes(SHORT_NOTE_MAX),
});

export type ImportRowParsed = z.infer<typeof ImportRowSchema>;
