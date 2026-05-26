import ExcelJS from 'exceljs';

import { createClient } from '@/lib/supabase/server';
import type { Json } from '@/types/database';

import { parseCsv } from '../domain/parse-table';
import type { ImportRow, ImportRowError } from '../types';

/** Read an uploaded CSV/XLSX file into a row grid of display strings. */
export async function parseFileToGrid(file: File): Promise<string[][]> {
  const buffer = await file.arrayBuffer();

  if (file.name.toLowerCase().endsWith('.csv')) {
    return parseCsv(new TextDecoder('utf-8').decode(buffer));
  }

  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);
  const sheet = workbook.worksheets[0];
  if (!sheet) return [];

  const grid: string[][] = [];
  sheet.eachRow({ includeEmpty: false }, (row) => {
    const cells: string[] = [];
    for (let c = 1; c <= sheet.columnCount; c += 1) cells.push(row.getCell(c).text ?? '');
    grid.push(cells);
  });
  return grid;
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
}): Promise<void> {
  const supabase = await createClient();
  await supabase
    .from('import_jobs')
    .insert({
      user_id: input.userId,
      type: 'cases',
      file_name: input.fileName,
      file_size: input.fileSize,
      status: 'completed',
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
