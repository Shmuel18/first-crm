import { createAdminClient } from '@/lib/supabase/admin';

type CasesExportFormat = 'xlsx' | 'pdf';

/**
 * Records a bulk PII export (case list → XLSX/PDF) in the audit log. These
 * exports include client names and national IDs, so they must leave a trail.
 *
 * The per-row audit triggers only fire on INSERT/UPDATE/DELETE, and direct
 * inserts into audit_log are RLS-blocked for normal users, so the row is
 * written via the service-role client. record_id is the actor (a bulk export
 * has no single subject row); the format + count live in changed_fields.
 *
 * Best-effort: an audit-write failure must never break the export itself.
 */
export async function logCasesExport(params: {
  userId: string;
  format: CasesExportFormat;
  count: number;
}): Promise<void> {
  const admin = createAdminClient();
  const { error } = await admin.from('audit_log').insert({
    table_name: 'cases',
    record_id: params.userId,
    action: 'EXPORT',
    changed_fields: { format: params.format, count: params.count },
    user_id: params.userId,
  });
  if (error) {
    console.error('logCasesExport failed', error.message);
  }
}

export type PiiAccessKind = 'bank_pdf' | 'document_view';

/**
 * Records a single-record disclosure of client PII — the bank PDF (full
 * borrower file) or a document's bytes — so "who looked at this client's
 * papers" has an answer (security review 2026-06-19, P1). Thumbnails are not
 * logged: a folder grid would write one row per tile without anyone reading.
 *
 * Same mechanics as logCasesExport: service-role insert (direct audit_log
 * inserts are RLS-blocked), action EXPORT, best-effort — call it from
 * `after()` so the disclosure itself never waits on or fails with the audit.
 */
export async function logPiiAccess(params: {
  userId: string;
  kind: PiiAccessKind;
  table: 'cases' | 'documents';
  recordId: string;
  detail?: string;
}): Promise<void> {
  const admin = createAdminClient();
  const { error } = await admin.from('audit_log').insert({
    table_name: params.table,
    record_id: params.recordId,
    action: 'EXPORT',
    changed_fields: { kind: params.kind, ...(params.detail ? { detail: params.detail } : {}) },
    user_id: params.userId,
  });
  if (error) {
    console.error('logPiiAccess failed', error.message);
  }
}
