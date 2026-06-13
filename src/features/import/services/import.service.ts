import ExcelJS from 'exceljs';

import { createClient } from '@/lib/supabase/server';
import type { Json } from '@/types/database';

import { mapRows, parseCsvSource, type SourceRow } from '../domain/parse-table';
import type { ImportRow, ImportRowError } from '../types';

// Hebrew-locale Excel often saves plain "CSV" as Windows-1255; a UTF-8 decode
// then yields U+FFFD replacement chars and the header aliases never match.
const REPLACEMENT_CHAR = '�';
// Bounds against pathological sheets: a stray cell at column 16384 would
// otherwise build 16k-wide rows, and the row cap is checked only after a full
// parse — bail early instead (the action enforces MAX_ROWS=2000 + header).
const MAX_COLUMNS = 30;
const MAX_GRID_ROWS = 2002;

/** Read an uploaded CSV/XLSX file into source rows (cells + true file row). */
export async function parseFileToGrid(file: File): Promise<SourceRow[]> {
  const buffer = await file.arrayBuffer();

  if (file.name.toLowerCase().endsWith('.csv')) {
    let text = new TextDecoder('utf-8').decode(buffer);
    if (text.includes(REPLACEMENT_CHAR)) {
      text = new TextDecoder('windows-1255').decode(buffer);
    }
    return parseCsvSource(text).slice(0, MAX_GRID_ROWS);
  }

  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);
  const sheet = workbook.worksheets[0];
  if (!sheet) return [];

  const grid: SourceRow[] = [];
  const columnCount = Math.min(sheet.columnCount, MAX_COLUMNS);
  sheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    if (grid.length >= MAX_GRID_ROWS) return;
    const cells: string[] = [];
    for (let c = 1; c <= columnCount; c += 1) cells.push(row.getCell(c).text ?? '');
    // rowNumber is the TRUE sheet row (gaps included) — error reports use it.
    grid.push({ cells, sourceRow: rowNumber });
  });
  return grid;
}

export type PreparedImport = {
  /** Mapped, non-empty rows ready for validation (payload order). */
  mapped: ImportRow[];
  /** True file row number of each payload row (error-report translation). */
  fileRowOf: number[];
  /** Header cells whose columns were dropped (unrecognized). */
  unmappedHeaders: string[];
};

/** Parse + header-map + empty-filter, preserving each row's TRUE file row. */
export async function prepareImportRows(file: File): Promise<PreparedImport> {
  const source = await parseFileToGrid(file);
  const { rows, unmappedHeaders } = mapRows(source.map((r) => r.cells));
  const entries = rows
    .map((row, i) => ({ row, fileRow: source[i + 1]?.sourceRow ?? i + 2 }))
    .filter((e) => Object.keys(e.row).length > 0);
  return {
    mapped: entries.map((e) => e.row),
    fileRowOf: entries.map((e) => e.fileRow),
    unmappedHeaders,
  };
}

export type CasesImportOutcome = { created: number; errors: ImportRowError[] };

/** Call the import_cases RPC (migration 037). */
export async function runCasesImport(rows: ImportRow[]): Promise<CasesImportOutcome | null> {
  const supabase = await createClient();
  // The RPC is typed `p_rows: Json`; ImportRow[] satisfies that structurally
  // but TS won't widen — cast once at the boundary.
  const { data, error } = await supabase.rpc('import_cases', {
    p_rows: rows as unknown as Json,
  });
  if (error || !data) return null;
  // RPC returns Json; the function body shape is documented in migration 037.
  return data as unknown as CasesImportOutcome;
}

/** Best-effort record of an import run. */
export async function logImportJob(input: {
  userId: string;
  fileName: string;
  fileSize: number;
  total: number;
  created: number;
  errors: ImportRowError[];
  /** Override for runs that died before producing an outcome ('failed'). */
  status?: 'completed' | 'failed';
}): Promise<void> {
  const supabase = await createClient();
  await supabase
    .from('import_jobs')
    .insert({
      user_id: input.userId,
      type: 'cases',
      file_name: input.fileName,
      file_size: input.fileSize,
      // A blocked all-or-nothing run (errors, nothing written) is 'failed' so
      // the import history distinguishes it from a real completed import.
      status: input.status ?? (input.errors.length > 0 ? 'failed' : 'completed'),
      completed_at: new Date().toISOString(),
      total_rows: input.total,
      success_rows: input.created,
      error_rows: input.errors.length,
      // ImportRowError[] is structurally JSON-compatible; cast at the boundary.
      errors: input.errors as unknown as Json,
    })
    .then(
      () => undefined,
      () => undefined,
    );
}
