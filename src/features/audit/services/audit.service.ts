import { createAdminClient } from '@/lib/supabase/admin';

import type { Json } from '@/types/database';

export type AuditEntry = {
  id: string;
  action: string;
  tableName: string;
  recordId: string;
  timestamp: string;
  actorName: string | null;
  changedFields: string[];
};

type AuditRow = {
  id: string;
  action: string;
  table_name: string;
  record_id: string;
  timestamp: string;
  changed_fields: Json | null;
  user_id: string | null;
};

function extractChangedFields(changed: Json | null): string[] {
  if (!changed || typeof changed !== 'object' || Array.isArray(changed)) return [];
  return Object.keys(changed);
}

/** Resolve actor names and map raw audit rows to display entries. */
async function resolveEntries(rows: AuditRow[]): Promise<AuditEntry[]> {
  if (rows.length === 0) return [];
  const admin = createAdminClient();

  const userIds = [...new Set(rows.map((r) => r.user_id).filter((v): v is string => !!v))];
  const nameById = new Map<string, string | null>();
  if (userIds.length > 0) {
    const { data: profiles } = await admin
      .from('profiles')
      .select('id, first_name, last_name')
      .in('id', userIds);
    for (const p of profiles ?? []) {
      nameById.set(p.id, [p.first_name, p.last_name].filter(Boolean).join(' ').trim() || null);
    }
  }

  return rows.map((row) => ({
    id: row.id,
    action: row.action,
    tableName: row.table_name,
    recordId: row.record_id,
    timestamp: row.timestamp,
    actorName: row.user_id ? nameById.get(row.user_id) ?? null : null,
    changedFields: extractChangedFields(row.changed_fields),
  }));
}

/**
 * Most-recent audit entries (whole system). Read via the service-role client so
 * the full log is visible regardless of per-table RLS — the /audit-log page
 * verifies admin before calling this.
 */
export async function listAuditEntries(limit = 100): Promise<AuditEntry[]> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from('audit_log')
    .select('id, action, table_name, record_id, timestamp, changed_fields, user_id')
    .order('timestamp', { ascending: false })
    .limit(limit);
  if (error || !data) return [];
  return resolveEntries(data);
}

/**
 * Audit entries for a single case row (status changes, field edits, archive,
 * etc.). The caller must verify the case is viewable first — this reads via the
 * service-role client to bypass audit_log RLS, scoped to the one record_id.
 */
export async function listAuditEntriesForCase(
  caseId: string,
  limit = 50,
): Promise<AuditEntry[]> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from('audit_log')
    .select('id, action, table_name, record_id, timestamp, changed_fields, user_id')
    .eq('table_name', 'cases')
    .eq('record_id', caseId)
    .order('timestamp', { ascending: false })
    .limit(limit);
  if (error || !data) return [];
  return resolveEntries(data);
}
