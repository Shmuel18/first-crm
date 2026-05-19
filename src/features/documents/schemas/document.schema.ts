import { z } from 'zod';

import {
  NOTES_MAX,
  optionalDate,
  optionalNotes,
  optionalUuid,
  requiredUuid,
} from '@/lib/validators/form-primitives';

export const DocumentMetadataSchema = z.object({
  category_id: requiredUuid('documents.errors.categoryRequired'),
  borrower_id: optionalUuid,
  notes: optionalNotes(NOTES_MAX),
  expiry_date: optionalDate,
});

export type DocumentMetadataInput = z.infer<typeof DocumentMetadataSchema>;

export const DocumentStatusSchema = z.enum([
  'new',
  'verified',
  'rejected',
  'expired',
  'not_relevant',
]);

export const MAX_FILE_SIZE_BYTES = 20 * 1024 * 1024; // 20 MB

export const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/heic',
  'image/heif',
  'image/webp',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
] as const;
