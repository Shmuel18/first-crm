/**
 * Allowed types + size for an office-expense invoice upload (feature #8).
 * Tighter than the full documents allow-list — an invoice is a PDF or a phone
 * photo, never an Office file. Enforced on BOTH the declared mime and the
 * file-type magic-byte sniff in uploadExpenseReceiptAction.
 */
export const RECEIPT_ALLOWED_MIME_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/heic',
  'image/heif',
] as const;

/**
 * 10 MB — invoices are small, and this stays well under the Server Action body
 * limit so the file can ride inside the FormData of a single action call.
 */
export const RECEIPT_MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;
