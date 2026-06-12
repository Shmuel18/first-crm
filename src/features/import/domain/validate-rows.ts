import { ImportRowSchema } from '../schemas/import-row.schema';
import type { ImportRow, ImportRowError } from '../types';

/** Map a failed field to a row-error code the panel can translate. */
const FIELD_CODE: Record<string, string> = {
  national_id: 'invalid_id',
  phone: 'invalid_phone',
  email: 'invalid_email',
  advisor_email: 'invalid_email',
};

export type ValidatedRows = {
  /** Rows rebuilt from the PARSED (validated + normalized) values. */
  rows: ImportRow[];
  /** Structured row errors (1-based index, matching the RPC's numbering). */
  errors: ImportRowError[];
};

/**
 * Validate + normalize every mapped row through the shared form primitives
 * BEFORE the RPC sees it. All-or-nothing like the RPC's own PASS 1: any
 * invalid row blocks the import with a full error report and nothing is sent.
 */
export function validateAndNormalizeRows(input: ImportRow[]): ValidatedRows {
  const rows: ImportRow[] = [];
  const errors: ImportRowError[] = [];

  input.forEach((raw, i) => {
    const parsed = ImportRowSchema.safeParse(raw);
    if (!parsed.success) {
      const field = String(parsed.error.issues[0]?.path[0] ?? '');
      errors.push({ row: i + 1, code: FIELD_CODE[field] ?? 'invalid_row' });
      return;
    }
    // Keep the RPC payload shape (string fields only, missing = absent).
    const out: ImportRow = {};
    for (const [key, value] of Object.entries(parsed.data)) {
      if (typeof value === 'string' && value.length > 0) {
        out[key as keyof ImportRow] = value;
      }
    }
    rows.push(out);
  });

  return { rows, errors };
}
