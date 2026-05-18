import { z } from 'zod';

const optionalString = z.preprocess(
  (v) => (v === '' || v === null ? undefined : v),
  z.string().optional(),
);

const optionalUuid = z.preprocess(
  (v) => (v === '' || v === null ? undefined : v),
  z.string().uuid().optional(),
);

const optionalDate = z.preprocess(
  (v) => (v === '' || v === null ? undefined : v),
  z.string().optional(),
);

export const DocumentMetadataSchema = z.object({
  category_id: z.string().uuid({ message: 'יש לבחור סוג מסמך' }),
  borrower_id: optionalUuid,
  notes: optionalString,
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
