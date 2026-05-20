import type { SupabaseClient } from '@supabase/supabase-js';

import { createAdminClient } from '@/lib/supabase/admin';

import type { Database } from '@/types/database';

/**
 * Allowlist of business tables included in a backup. Explicit allowlist (not
 * "dump everything") so a future secret-bearing table is never written to Drive
 * by accident. Notably EXCLUDES: office_integrations (holds OAuth tokens),
 * notifications + audit_log + import_jobs + document_drive_tombstones
 * (ephemeral / bookkeeping). `satisfies` guarantees every name is a real table.
 */
const BACKUP_TABLES = [
  'cases',
  'borrowers',
  'case_borrowers',
  'case_banks',
  'case_financials',
  'banks',
  'case_statuses',
  'case_types',
  'case_type_documents',
  'document_categories',
  'documents',
  'borrower_incomes',
  'borrower_obligations',
  'income_types',
  'tasks',
  'leads',
  'reminder_rules',
  'holidays',
  'roles',
  'permissions',
  'role_permissions',
  'user_permission_overrides',
  'profiles',
  'office_settings',
  'stage_durations',
] as const satisfies readonly (keyof Database['public']['Tables'])[];

type BackupTable = (typeof BACKUP_TABLES)[number];

/**
 * Columns stripped from the backup even though their table is included. These
 * hold live credentials (OAuth refresh tokens) that must never be written to a
 * Drive file — a restore re-authenticates rather than replaying a stale token.
 */
const REDACTED_COLUMNS: Partial<Record<BackupTable, readonly string[]>> = {
  profiles: ['google_calendar_refresh_token'],
};

const PAGE_SIZE = 1000;

function redactRow(row: unknown, columns: readonly string[]): unknown {
  if (!row || typeof row !== 'object') return row;
  const copy = { ...(row as Record<string, unknown>) };
  for (const c of columns) delete copy[c];
  return copy;
}

export type BackupSnapshot = {
  data: Record<string, unknown[]>;
  counts: Record<string, number>;
};

async function fetchAllRows(db: SupabaseClient, table: BackupTable): Promise<unknown[]> {
  const out: unknown[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await db
      .from(table)
      .select('*')
      .range(from, from + PAGE_SIZE - 1);
    if (error) throw new Error(`backup read failed for ${table}: ${error.message}`);
    const batch = (data ?? []) as unknown[];
    out.push(...batch);
    if (batch.length < PAGE_SIZE) break;
  }
  return out;
}

/**
 * Read every allowlisted table in full. Runs with the service-role client, so
 * the caller MUST have verified admin status first. Any read error aborts the
 * whole backup — a partial snapshot that looks complete is worse than none.
 */
export async function buildBackupSnapshot(): Promise<BackupSnapshot> {
  // Untyped view of the client: backup iterates table names dynamically, which
  // the typed `.from()` overloads can't express without a union-too-complex error.
  const db = createAdminClient() as unknown as SupabaseClient;

  const data: Record<string, unknown[]> = {};
  const counts: Record<string, number> = {};
  for (const table of BACKUP_TABLES) {
    const rows = await fetchAllRows(db, table);
    const redacted = REDACTED_COLUMNS[table];
    data[table] = redacted ? rows.map((r) => redactRow(r, redacted)) : rows;
    counts[table] = rows.length;
  }
  return { data, counts };
}
