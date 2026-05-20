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

function extractChangedFields(changed: Json | null): string[] {
  if (!changed || typeof changed !== 'object' || Array.isArray(changed)) return [];
  return Object.keys(changed);
}

/**
 * Most-recent audit entries with the actor's name resolved. Read via the
 * service-role client so the full log is visible regardless of per-table RLS —
 * the /audit-log page verifies admin before calling this.
 */
export async function listAuditEntries(limit = 100): Promise<AuditEntry[]> {
  const admin = createAdminClient();

  const { data, error } = await admin
    .from('audit_log')
    .select('id, action, table_name, record_id, timestamp, changed_fields, user_id')
    .order('timestamp', { ascending: false })
    .limit(limit);
  if (error || !data) return [];

  const userIds = [...new Set(data.map((r) => r.user_id).filter((v): v is string => !!v))];
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

  return data.map((row) => ({
    id: row.id,
    action: row.action,
    tableName: row.table_name,
    recordId: row.record_id,
    timestamp: row.timestamp,
    actorName: row.user_id ? nameById.get(row.user_id) ?? null : null,
    changedFields: extractChangedFields(row.changed_fields),
  }));
}
