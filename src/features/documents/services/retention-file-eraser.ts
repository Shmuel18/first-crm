import { DOCUMENTS_BUCKET } from '@/features/documents/services/documents.service';
import { eraseDriveTargets } from '@/features/integrations/services/drive-case-uploader';
import { createAdminClient } from '@/lib/supabase/admin';
import type { Json } from '@/types/database';

/**
 * Retention file erasure (LEGAL-3). The ONLY place that can reach Supabase
 * Storage + Google Drive — pg_cron / SQL cannot — so it erases the files and
 * NULLs the pointers; the SQL purge (cleanup_soft_deleted_records, migration
 * 139) finalizes a row once BOTH pointers are gone (or past the backstop). The
 * SQL backstop is the real bound, so a slow/partial run here is always safe.
 *
 * Covers document blobs (documents.metadata.storage_path + drive_file_id) AND
 * expense receipts (case_expenses.receipt_path + receipt_drive_id), for rows
 * directly soft-deleted past the retention window AND rows whose parent case is
 * soft-deleted (cascade-doomed). Queries filter to rows that still have a
 * pointer and order by id, so processed rows drop out and runs make guaranteed
 * forward progress.
 *
 * A successful Storage remove() nulls the pointer for EVERY requested path —
 * Supabase omits already-absent paths from its result, and "absent" is the
 * desired end state, so confirming only the echoed names would wedge a row whose
 * blob was already gone. Drive is best-effort: a left-behind copy on a
 * disconnected Drive is bounded by the SQL backstop + manual cleanup.
 */

const DEFAULT_RETENTION_DAYS = 14;
/** Per-batch cap per entity. Kept modest so one run (≤2× Storage + Drive
 *  passes) stays well under the route's 60s budget; the SQL backstop makes a
 *  truncated run safe, and successive runs drain deterministically. */
const BATCH_SIZE = 100;
/** Bound the cascade fan-out so the .in() id list can't grow without limit. */
const CASE_LIMIT = 100;

const DOC_FILE_FILTER = 'metadata->>storage_path.not.is.null,drive_file_id.not.is.null';
const EXP_FILE_FILTER = 'receipt_path.not.is.null,receipt_drive_id.not.is.null';

type Admin = ReturnType<typeof createAdminClient>;

export type EraseSection = {
  scanned: number;
  blobsRemoved: number;
  driveDeleted: number;
  driveDisconnected: boolean;
};

export type EraseRetiredResult =
  | { ok: true; cutoff: string; documents: EraseSection; expenses: EraseSection }
  | { ok: false; error: string };

export async function eraseRetiredFiles(): Promise<EraseRetiredResult> {
  const admin = createAdminClient();

  const { data: settings } = await admin
    .from('office_settings')
    .select('deleted_records_retention_days')
    .eq('id', 1)
    .maybeSingle();
  const retentionRaw = Number(settings?.deleted_records_retention_days);
  const graceDays =
    Number.isFinite(retentionRaw) && retentionRaw >= 1 ? retentionRaw : DEFAULT_RETENTION_DAYS;
  const cutoff = new Date(Date.now() - graceDays * 24 * 60 * 60 * 1000).toISOString();

  const { data: deadCases, error: caseErr } = await admin
    .from('cases')
    .select('id')
    .not('deleted_at', 'is', null)
    .lt('deleted_at', cutoff)
    .order('deleted_at', { ascending: true })
    .limit(CASE_LIMIT);
  if (caseErr) {
    console.error('[retention-eraser] dead-case select failed', { message: caseErr.message });
    return { ok: false, error: 'select_failed' };
  }
  const deadCaseIds = (deadCases ?? []).map((c) => c.id);

  // Attempt BOTH arms regardless of either's outcome — a documents fault must
  // not starve expense erasure (and vice versa).
  const documents = await eraseDocumentFiles(admin, cutoff, deadCaseIds);
  const expenses = await eraseExpenseFiles(admin, cutoff, deadCaseIds);
  if (!documents || !expenses) {
    return { ok: false, error: !documents ? 'documents_failed' : 'expenses_failed' };
  }
  return { ok: true, cutoff, documents, expenses };
}

function mergeRows<T extends { id: string }>(direct: T[], cascade: T[]): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const r of [...direct, ...cascade]) {
    if (seen.has(r.id)) continue;
    seen.add(r.id);
    out.push(r);
    if (out.length >= BATCH_SIZE) break;
  }
  return out;
}

function readStoragePath(metadata: Json | null): string | null {
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) return null;
  const raw = (metadata as Record<string, unknown>).storage_path;
  return typeof raw === 'string' && raw.length > 0 ? raw : null;
}

async function eraseDocumentFiles(
  admin: Admin,
  cutoff: string,
  deadCaseIds: string[],
): Promise<EraseSection | null> {
  const direct = await admin
    .from('documents')
    .select('id, metadata, drive_file_id')
    .not('deleted_at', 'is', null)
    .lt('deleted_at', cutoff)
    .or(DOC_FILE_FILTER)
    .order('id', { ascending: true })
    .limit(BATCH_SIZE);
  if (direct.error) {
    console.error('[retention-eraser] documents direct select failed', { message: direct.error.message });
    return null;
  }
  let cascade: NonNullable<typeof direct.data> = [];
  if (deadCaseIds.length > 0) {
    const c = await admin
      .from('documents')
      .select('id, metadata, drive_file_id')
      .in('case_id', deadCaseIds)
      .or(DOC_FILE_FILTER)
      .order('id', { ascending: true })
      .limit(BATCH_SIZE);
    if (c.error) {
      console.error('[retention-eraser] documents cascade select failed', { message: c.error.message });
      return null;
    }
    cascade = c.data ?? [];
  }
  const rows = mergeRows(direct.data ?? [], cascade);

  type Cand = { id: string; path: string | null; driveId: string | null; metadata: Json | null };
  const cands: Cand[] = rows
    .map((r) => ({
      id: r.id,
      path: readStoragePath(r.metadata),
      driveId:
        typeof r.drive_file_id === 'string' && r.drive_file_id.length > 0 ? r.drive_file_id : null,
      metadata: r.metadata,
    }))
    .filter((c) => c.path || c.driveId);

  const section: EraseSection = { scanned: rows.length, blobsRemoved: 0, driveDeleted: 0, driveDisconnected: false };

  // --- Storage blobs ---
  const withPath = cands.filter((c): c is Cand & { path: string } => c.path !== null);
  if (withPath.length > 0) {
    const { error } = await admin.storage.from(DOCUMENTS_BUCKET).remove(withPath.map((c) => c.path));
    if (error) {
      console.error('[retention-eraser] documents storage.remove failed', { message: error.message });
      return null;
    }
    // No error ⇒ every requested path is gone (deleted or already absent). Null
    // the pointer for ALL of them — confirming only the echoed names would wedge
    // a row whose blob was already gone.
    for (const c of withPath) {
      const cleared =
        c.metadata && typeof c.metadata === 'object' && !Array.isArray(c.metadata)
          ? { ...(c.metadata as Record<string, unknown>) }
          : {};
      delete cleared.storage_path;
      const { error: updErr } = await admin
        .from('documents')
        .update({ metadata: cleared as unknown as Json })
        .eq('id', c.id);
      if (updErr) {
        console.error('[retention-eraser] documents pointer clear failed', { id: c.id, message: updErr.message });
        continue;
      }
      section.blobsRemoved += 1;
    }
  }

  // --- Drive copies (best-effort; bounded by the SQL backstop) ---
  const withDrive = cands.filter((c): c is Cand & { driveId: string } => c.driveId !== null);
  if (withDrive.length > 0) {
    const res = await eraseDriveTargets({ fileIds: withDrive.map((c) => c.driveId) });
    if (!res.connected) {
      section.driveDisconnected = true;
      console.warn('[retention-eraser] Drive not connected — document Drive copies left', { count: withDrive.length });
    } else {
      const deleted = new Set(res.deleted);
      const clearIds = withDrive.filter((c) => deleted.has(c.driveId)).map((c) => c.id);
      if (clearIds.length > 0) {
        const { error: updErr } = await admin.from('documents').update({ drive_file_id: null }).in('id', clearIds);
        if (updErr) {
          console.error('[retention-eraser] documents drive_file_id clear failed', { message: updErr.message });
        } else {
          section.driveDeleted = clearIds.length;
        }
      }
    }
  }

  return section;
}

async function eraseExpenseFiles(
  admin: Admin,
  cutoff: string,
  deadCaseIds: string[],
): Promise<EraseSection | null> {
  const direct = await admin
    .from('case_expenses')
    .select('id, receipt_path, receipt_drive_id')
    .not('deleted_at', 'is', null)
    .lt('deleted_at', cutoff)
    .or(EXP_FILE_FILTER)
    .order('id', { ascending: true })
    .limit(BATCH_SIZE);
  if (direct.error) {
    console.error('[retention-eraser] expenses direct select failed', { message: direct.error.message });
    return null;
  }
  let cascade: NonNullable<typeof direct.data> = [];
  if (deadCaseIds.length > 0) {
    const c = await admin
      .from('case_expenses')
      .select('id, receipt_path, receipt_drive_id')
      .in('case_id', deadCaseIds)
      .or(EXP_FILE_FILTER)
      .order('id', { ascending: true })
      .limit(BATCH_SIZE);
    if (c.error) {
      console.error('[retention-eraser] expenses cascade select failed', { message: c.error.message });
      return null;
    }
    cascade = c.data ?? [];
  }
  const rows = mergeRows(direct.data ?? [], cascade);

  type Cand = { id: string; path: string | null; driveId: string | null };
  const cands: Cand[] = rows
    .map((r) => ({
      id: r.id,
      path: typeof r.receipt_path === 'string' && r.receipt_path.length > 0 ? r.receipt_path : null,
      driveId:
        typeof r.receipt_drive_id === 'string' && r.receipt_drive_id.length > 0 ? r.receipt_drive_id : null,
    }))
    .filter((c) => c.path || c.driveId);

  const section: EraseSection = { scanned: rows.length, blobsRemoved: 0, driveDeleted: 0, driveDisconnected: false };

  // --- Storage blobs (receipt_path is a column → bulk-null) ---
  const withPath = cands.filter((c): c is Cand & { path: string } => c.path !== null);
  if (withPath.length > 0) {
    const { error } = await admin.storage.from(DOCUMENTS_BUCKET).remove(withPath.map((c) => c.path));
    if (error) {
      console.error('[retention-eraser] expenses storage.remove failed', { message: error.message });
      return null;
    }
    const ids = withPath.map((c) => c.id);
    const { error: updErr } = await admin.from('case_expenses').update({ receipt_path: null }).in('id', ids);
    if (updErr) {
      console.error('[retention-eraser] expenses receipt_path clear failed', { message: updErr.message });
    } else {
      section.blobsRemoved = ids.length;
    }
  }

  // --- Drive copies (best-effort) ---
  const withDrive = cands.filter((c): c is Cand & { driveId: string } => c.driveId !== null);
  if (withDrive.length > 0) {
    const res = await eraseDriveTargets({ fileIds: withDrive.map((c) => c.driveId) });
    if (!res.connected) {
      section.driveDisconnected = true;
      console.warn('[retention-eraser] Drive not connected — expense Drive copies left', { count: withDrive.length });
    } else {
      const deleted = new Set(res.deleted);
      const clearIds = withDrive.filter((c) => deleted.has(c.driveId)).map((c) => c.id);
      if (clearIds.length > 0) {
        const { error: updErr } = await admin
          .from('case_expenses')
          .update({ receipt_drive_id: null })
          .in('id', clearIds);
        if (updErr) {
          console.error('[retention-eraser] expenses receipt_drive_id clear failed', { message: updErr.message });
        } else {
          section.driveDeleted = clearIds.length;
        }
      }
    }
  }

  return section;
}
