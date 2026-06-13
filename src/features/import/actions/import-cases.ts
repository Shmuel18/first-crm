'use server';

import { revalidatePath } from 'next/cache';

import { isCurrentUserAdmin } from '@/lib/auth/permissions';
import { checkRateLimit } from '@/lib/rate-limit';
import { createClient } from '@/lib/supabase/server';

import { validateAndNormalizeRows } from '../domain/validate-rows';
import { findPossibleDuplicates } from '../services/import-duplicates';
import { logImportJob, prepareImportRows, runCasesImport } from '../services/import.service';
import type { ImportResult, ImportRowError } from '../types';

const MAX_BYTES = 5 * 1024 * 1024;
const MAX_ROWS = 2000;

export async function importCasesAction(formData: FormData): Promise<ImportResult> {
  const supabase = await createClient();
  const { data: userRes } = await supabase.auth.getUser();
  if (!userRes.user) return { ok: false, error: 'unauthorized' };
  if (!(await isCurrentUserAdmin())) return { ok: false, error: 'unauthorized' };

  // 5/hour mirrors the mass-create cost; the RPC re-enforces admin + a row cap
  // server-side (mig 168) so this gate can't be bypassed via direct PostgREST.
  const allowed = await checkRateLimit({
    action: 'import_cases',
    subject: `user:${userRes.user.id}`,
    max: 5,
    windowSeconds: 3600,
    failMode: 'closed',
  });
  if (!allowed) return { ok: false, error: 'rate_limited' };

  const file = formData.get('file');
  if (!(file instanceof File) || file.size === 0) return { ok: false, error: 'no_file' };
  if (file.size > MAX_BYTES) return { ok: false, error: 'too_large' };

  let prepared;
  try {
    prepared = await prepareImportRows(file);
  } catch {
    return { ok: false, error: 'parse' };
  }
  const { mapped, fileRowOf, unmappedHeaders } = prepared;

  if (mapped.length === 0) return { ok: false, error: 'empty' };
  if (mapped.length > MAX_ROWS) return { ok: false, error: 'too_large' };

  // Error rows are reported against the TRUE file row (header/blank/empty
  // rows shift the payload index — R3-import-4).
  const toFileRows = (errs: ImportRowError[]): ImportRowError[] =>
    errs.map((e) => ({ ...e, row: fileRowOf[e.row - 1] ?? e.row }));
  const log = (created: number, errors: ImportRowError[], status?: 'failed') =>
    logImportJob({
      userId: userRes.user!.id,
      fileName: file.name,
      fileSize: file.size,
      total: mapped.length,
      created,
      errors,
      ...(status ? { status } : {}),
    });

  // Validate + NORMALIZE through the shared form primitives (canonical phone,
  // lowercase email, ID shape, length caps) — the RPC persists raw values, so
  // this is where the forms' data invariants are enforced for bulk import.
  // All-or-nothing, mirroring the RPC's own PASS 1.
  const { rows, errors: rowErrors } = validateAndNormalizeRows(mapped);
  if (rowErrors.length > 0) {
    const errors = toFileRows(rowErrors);
    await log(0, errors);
    return { ok: true, created: 0, total: mapped.length, errors, unmappedHeaders };
  }

  // ID-less rows have no RPC-side dedup key — block exact name+phone matches
  // of existing ID-less borrowers so a re-upload can't silently duplicate.
  const dupErrors = await findPossibleDuplicates(rows, fileRowOf);
  if (dupErrors.length > 0) {
    await log(0, dupErrors);
    return { ok: true, created: 0, total: mapped.length, errors: dupErrors, unmappedHeaders };
  }

  const outcome = await runCasesImport(rows);
  if (!outcome) {
    await log(0, [], 'failed');
    return { ok: false, error: 'unknown' };
  }

  const errors = toFileRows(outcome.errors);
  await log(outcome.created, errors);

  revalidatePath('/cases');
  return { ok: true, created: outcome.created, total: rows.length, errors, unmappedHeaders };
}
