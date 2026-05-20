'use server';

import { revalidatePath } from 'next/cache';

import { isCurrentUserAdmin } from '@/lib/auth/permissions';
import { createClient } from '@/lib/supabase/server';

import { mapRows } from '../domain/parse-table';
import { logImportJob, parseFileToGrid, runCasesImport } from '../services/import.service';
import type { ImportResult } from '../types';

const MAX_BYTES = 5 * 1024 * 1024;
const MAX_ROWS = 2000;

export async function importCasesAction(formData: FormData): Promise<ImportResult> {
  const supabase = await createClient();
  const { data: userRes } = await supabase.auth.getUser();
  if (!userRes.user) return { ok: false, error: 'unauthorized' };
  if (!(await isCurrentUserAdmin())) return { ok: false, error: 'unauthorized' };

  const file = formData.get('file');
  if (!(file instanceof File) || file.size === 0) return { ok: false, error: 'no_file' };
  if (file.size > MAX_BYTES) return { ok: false, error: 'too_large' };

  let rows;
  try {
    const grid = await parseFileToGrid(file);
    rows = mapRows(grid).filter((r) => Object.keys(r).length > 0);
  } catch {
    return { ok: false, error: 'parse' };
  }

  if (rows.length === 0) return { ok: false, error: 'empty' };
  if (rows.length > MAX_ROWS) return { ok: false, error: 'too_large' };

  const outcome = await runCasesImport(rows);
  if (!outcome) return { ok: false, error: 'unknown' };

  await logImportJob({
    userId: userRes.user.id,
    fileName: file.name,
    fileSize: file.size,
    total: rows.length,
    created: outcome.created,
    errors: outcome.errors,
  });

  revalidatePath('/cases');
  return { ok: true, created: outcome.created, total: rows.length, errors: outcome.errors };
}
