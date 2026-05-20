import { IMPORT_FIELDS, type ImportField, type ImportRow } from '../types';

/**
 * Minimal RFC-4180-ish CSV parser: handles double-quoted fields with embedded
 * commas, quotes ("") and newlines. Returns a grid of trimmed-on-read strings;
 * fully-empty rows are dropped.
 */
export function parseCsv(text: string): string[][] {
  const s = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < s.length; i += 1) {
    const c = s[i];
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
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else {
      field += c;
    }
  }
  if (field !== '' || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  return rows.filter((r) => r.some((cell) => cell.trim() !== ''));
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
  return h.trim().toLowerCase().replace(/["'.\s]/g, '');
}

/**
 * Map a parsed grid (first row = header) to import rows by matching each header
 * against the known aliases. Unrecognized columns are ignored.
 */
export function mapRows(grid: string[][]): ImportRow[] {
  if (grid.length < 2) return [];
  const header = (grid[0] ?? []).map(normalizeHeader);
  const columnField: (ImportField | null)[] = header.map((h) => {
    for (const field of IMPORT_FIELDS) {
      if (ALIASES[field].includes(h)) return field;
    }
    return null;
  });

  return grid.slice(1).map((cols) => {
    const out: ImportRow = {};
    columnField.forEach((field, i) => {
      const value = cols[i];
      if (field && value != null && value.trim() !== '') out[field] = value.trim();
    });
    return out;
  });
}
