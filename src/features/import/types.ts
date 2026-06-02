export const IMPORT_FIELDS = [
  'first_name',
  'last_name',
  'national_id',
  'phone',
  'email',
  'status',
  'advisor_email',
  'short_note',
] as const;
export type ImportField = (typeof IMPORT_FIELDS)[number];

/** One mapped row, ready to send to the import_cases RPC. */
export type ImportRow = Partial<Record<ImportField, string>>;

export type ImportRowError = { row: number; code: string };

export type ImportResult =
  | { ok: true; created: number; total: number; errors: ImportRowError[] }
  | {
      ok: false;
      error:
        | 'unauthorized'
        | 'no_file'
        | 'empty'
        | 'too_large'
        | 'parse'
        | 'rate_limited'
        | 'unknown';
    };
