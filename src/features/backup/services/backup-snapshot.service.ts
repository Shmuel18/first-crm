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
  'case_associated_advisors',
  'case_banks',
  'case_bank_statuses',
  'case_financials',
  'case_expenses',
  'case_properties',
  'case_payouts',
  'case_fee_payments',
  'maaser_payments',
  'maaser_ledger_entries',
  'time_entries',
  'case_comments',
  'banks',
  'case_statuses',
  'case_types',
  'case_type_documents',
  'document_categories',
  'checklist_templates',
  'documents',
  'case_checklist_items',
  'borrower_incomes',
  'borrower_obligations',
  'income_types',
  'tasks',
  'task_assignment_history',
  'task_comments',
  'task_attachments',
  'leads',
  'reminder_rules',
  'holidays',
  'roles',
  'permissions',
  'role_permissions',
  'user_permission_overrides',
  'profiles',
  'office_settings',
  'message_templates',
  'system_email_templates',
  'notification_preferences',
  'stage_durations',
  'mortgage_scenarios',
  'scenario_tracks',
] as const satisfies readonly (keyof Database['public']['Tables'])[];

type BackupTable = (typeof BACKUP_TABLES)[number];

/**
 * Columns stripped from the backup even though their table is included.
 *
 * Defense-in-depth: the whole snapshot is encrypted with BACKUP_ENCRYPTION_KEY
 * before it's uploaded to Drive (see actions/run-backup.ts), so a Drive-only
 * compromise doesn't read PII or manager-only fields. Even so, live
 * credentials / secrets / MFA factors shouldn't be in the file at all — if
 * the encryption key ever leaks alongside a backup, replay / impersonation
 * is worse than losing the column (a restore re-authenticates / re-enrolls).
 *
 * The names below include plausible future credential-style columns that
 * don't exist today. Cheap to list now, expensive to discover were missed
 * after a leak.
 */
const REDACTED_COLUMNS: Partial<Record<BackupTable, readonly string[]>> = {
  profiles: [
    'google_calendar_refresh_token',
    'password_hash',
    'recovery_token',
    'mfa_secret',
    'totp_secret',
    'api_key',
    'session_token',
  ],
  office_settings: [
    // bank_account_number — sensitive even before migration 061 tightens
    // SELECT to admin-only. Restore re-enters this once from the office
    // settings UI.
    'bank_account_number',
  ],
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
    // select('*') is intentional here: a backup snapshot needs EVERY column
    // for restore to round-trip cleanly. New columns should auto-include
    // (REDACTED_COLUMNS + the file-level encryption are the real safety
    // net, not an allowlist). Re-check that net when adding sensitive cols.
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
