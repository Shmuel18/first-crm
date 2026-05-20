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
