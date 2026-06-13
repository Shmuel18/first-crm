import { IMPORT_FIELDS, type ImportField, type ImportRow } from '../types';

/** One parsed source row: its cells + its 1-based row number in the FILE
 *  (survives blank-line filtering, so error reports point at the real row). */
export type SourceRow = { cells: string[]; sourceRow: number };

/**
 * Minimal RFC-4180-ish CSV parser: handles double-quoted fields with embedded
 * commas, quotes ("") and newlines. Fully-empty rows are dropped, but each
 * kept row remembers its original 1-based line number (R3-import-4: error
 * reports must point at the spreadsheet row the admin actually sees).
 */
export function parseCsvSource(text: string): SourceRow[] {
  const s = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const rows: SourceRow[] = [];
  let row: string[] = [];
  let rowStartLine = 1;
  let line = 1;
  let field = '';
  let inQuotes = false;

  const pushRow = () => {
    row.push(field);
    rows.push({ cells: row, sourceRow: rowStartLine });
    row = [];
    field = '';
    rowStartLine = line;
  };

  for (let i = 0; i < s.length; i += 1) {
    const c = s[i];
    if (c === '\n') line += 1;
    if (inQuotes) {
      if (c === '"') {
        if (s[i + 1] === '"') {
          field += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        field += c;
      }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ',') {
      row.push(field);
      field = '';
    } else if (c === '\n') {
      pushRow();
    } else {
      field += c;
    }
  }
  if (field !== '' || row.length > 0) pushRow();

  return rows.filter((r) => r.cells.some((cell) => cell.trim() !== ''));
}

/** Cells-only view of parseCsvSource (kept for existing callers/tests). */
export function parseCsv(text: string): string[][] {
  return parseCsvSource(text).map((r) => r.cells);
}

// Normalized header aliases (lowercased, quotes/dots/whitespace stripped).
const ALIASES: Record<ImportField, readonly string[]> = {
  first_name: ['first_name', 'firstname', 'שםפרטי', 'שם'],
  last_name: ['last_name', 'lastname', 'שםמשפחה', 'משפחה'],
  national_id: ['national_id', 'id', 'תז', 'תעודתזהות'],
  phone: ['phone', 'mobile', 'טלפון', 'נייד', 'מספרטלפון'],
  email: ['email', 'mail', 'אימייל', 'מייל', 'דואל'],
  status: ['status', 'stage', 'סטטוס', 'שלב', 'שלבבתהליך'],
  advisor_email: ['advisor_email', 'advisor', 'advisoremail', 'יועץ', 'מטפל', 'אימייליועץ', 'עובדמטפל'],
  short_note: ['short_note', 'note', 'notes', 'הערה', 'הערות', 'הערהקצרה'],
};

function normalizeHeader(h: string): string {
  // ׳/״ = Hebrew geresh/gershayim — typographic Excel headers write
  // ת״ז with U+05F4, which the plain-quote class missed, silently dropping
  // the whole national_id column (R3-import-4).
  return h
    .trim()
    .toLowerCase()
    .replace(/["'.\s׳״‘’“”]/g, '');
}

export type MappedGrid = {
  rows: ImportRow[];
  /** Header cells that matched no known alias — their columns were dropped. */
  unmappedHeaders: string[];
};

/**
 * Map a parsed grid (first row = header) to import rows by matching each header
 * against the known aliases. Unrecognized columns are dropped AND reported so
 * the admin learns a misspelled header lost a column instead of finding out
 * after go-live (R3-import-4).
 */
export function mapRows(grid: string[][]): MappedGrid {
  if (grid.length < 2) return { rows: [], unmappedHeaders: [] };
  const rawHeader = grid[0] ?? [];
  const header = rawHeader.map(normalizeHeader);
  const unmappedHeaders: string[] = [];
  const columnField: (ImportField | null)[] = header.map((h, i) => {
    for (const field of IMPORT_FIELDS) {
      if (ALIASES[field].includes(h)) return field;
    }
    const original = (rawHeader[i] ?? '').trim();
    if (original !== '') unmappedHeaders.push(original);
    return null;
  });

  const rows = grid.slice(1).map((cols) => {
    const out: ImportRow = {};
    columnField.forEach((field, i) => {
      const value = cols[i];
      if (field && value != null && value.trim() !== '') out[field] = value.trim();
    });
    return out;
  });
  return { rows, unmappedHeaders };
}
