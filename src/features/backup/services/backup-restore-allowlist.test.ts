/**
 * Drift guard for the backup <-> restore table allowlists.
 *
 * Why this test exists (the P0 it prevents): the backup writer keeps its table
 * allowlist in TypeScript (`BACKUP_TABLES` in backup-snapshot.service.ts) while
 * the restore RPC keeps a SEPARATE hardcoded list (`v_tables` in the latest
 * restore_backup_snapshot migration). They drifted — `mortgage_scenarios` and
 * `scenario_tracks` were backed up but missing from the restore list, so a
 * restore silently dropped them and still reported success. Migration 115
 * closed the drift; this test keeps it closed.
 *
 * There is no database in the vitest setup (environment: 'node', no test DB),
 * so this is a STATIC guard: it reads both sources of truth as text and asserts
 * they stay in lockstep. It deliberately does NOT exercise the SQL itself
 * (FK order / NOT NULL / jsonb_populate_recordset) — that is the heavier
 * behavioral round-trip test, which needs a real Postgres (local Supabase).
 *
 * Reading the files as text (rather than importing BACKUP_TABLES) keeps the
 * test free of the service's server-only / env / admin-client import chain.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const HERE = dirname(fileURLToPath(import.meta.url));
const SERVICE_FILE = join(HERE, 'backup-snapshot.service.ts');
const MIGRATIONS_DIR = join(HERE, '..', '..', '..', '..', 'supabase', 'migrations');

/** Pull every single-quoted token out of a captured block. */
function quotedTokens(block: string): string[] {
  return [...block.matchAll(/'([^']+)'/g)].map((m) => m[1]!);
}

/** The `BACKUP_TABLES = [ ... ]` array from the TS service (non-greedy to the array's own `]`). */
function readBackupTables(): string[] {
  const src = readFileSync(SERVICE_FILE, 'utf8');
  const m = src.match(/BACKUP_TABLES\s*=\s*\[([\s\S]*?)\]/);
  if (!m) throw new Error('could not locate the BACKUP_TABLES array in backup-snapshot.service.ts');
  return quotedTokens(m[1]!);
}

/** The restore allowlists from the HIGHEST-numbered migration that (re)defines the RPC. */
function readRestoreLists(): { file: string; tables: string[]; deletedAt: string[] } {
  const files = readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith('.sql'))
    .sort((a, b) => parseInt(a, 10) - parseInt(b, 10));

  for (let i = files.length - 1; i >= 0; i--) {
    const file = files[i]!;
    const sql = readFileSync(join(MIGRATIONS_DIR, file), 'utf8');
    if (!/FUNCTION\s+public\.restore_backup_snapshot/.test(sql)) continue;

    const vt = sql.match(/v_tables\s+text\[\]\s*:=\s*ARRAY\[([\s\S]*?)\]/);
    if (!vt) continue;
    const da = sql.match(/v_tables_with_deleted_at\s+text\[\]\s*:=\s*ARRAY\[([\s\S]*?)\]/);

    return { file, tables: quotedTokens(vt[1]!), deletedAt: da ? quotedTokens(da[1]!) : [] };
  }
  throw new Error('no migration defines restore_backup_snapshot with a v_tables array');
}

const DATABASE_TYPES = join(HERE, '..', '..', '..', 'types', 'database.ts');

/** Every public table key from the generated database.ts (the schema source of truth). */
function readAllTableKeys(): string[] {
  const src = readFileSync(DATABASE_TYPES, 'utf8');
  const block = src.match(/Tables:\s*\{([\s\S]*?)\n {4}Views:/);
  if (!block) throw new Error('could not locate the public Tables block in database.ts');
  return [...block[1]!.matchAll(/^ {6}([a-z_][a-z0-9_]*):\s*\{/gm)].map((m) => m[1]!);
}

/**
 * Public tables intentionally NOT in the backup, each with a reason. The coverage
 * test below asserts every table is either backed up or listed here — so a future
 * DURABLE table can't silently fall out of BOTH lists (the silent-data-loss class
 * fixed in migs 115 / 193 / 197). Adding a new table forces a deliberate choice.
 */
const EXCLUDED_FROM_BACKUP: Record<string, string> = {
  // ephemeral / logs / meta — regenerated, not durable business data
  audit_log: 'append-only audit log',
  audit_log_default: 'audit_log partition',
  notifications: 'ephemeral bell feed',
  client_email_log: 'email send log',
  erasure_orphan_log: 'erasure bookkeeping',
  import_jobs: 'transient import state',
  document_drive_tombstones: 'Drive-sync bookkeeping',
  rate_limit_counters: 'ephemeral counters',
  schema_version: 'migration metadata',
  // secrets — must never be written to a backup file
  office_integrations: 'encrypted OAuth tokens',
  // device-scoped / cosmetic / re-derivable
  push_subscriptions: 'device push endpoints — clients re-subscribe',
  case_block_preferences: 'per-user UI layout — cosmetic, re-derivable',
  case_review_state: 'manager unread/viewed timestamps — cosmetic, self-heals next reset',
  // simulator reference / market data (mig 106) — seeded or refreshed from source
  approval_rulesets: 'simulator reference data (mig 106), re-seeded',
  bank_offers: 'simulator reference data (mig 106), re-seeded',
  bank_offer_tracks: 'simulator reference data (mig 106), re-seeded',
  purchase_tax_brackets: 'regulatory reference data (mig 106), re-seeded',
  market_data_sources: 'external market data, refreshed from source',
  market_data_snapshots: 'external market data, refreshed from source',
  market_data_points: 'external market data, refreshed from source',
};

describe('backup <-> restore allowlist parity', () => {
  const backup = readBackupTables();
  const restore = readRestoreLists();
  const backupSet = new Set(backup);
  const restoreSet = new Set(restore.tables);

  it('parses non-empty allowlists from both sources', () => {
    expect(backup.length).toBeGreaterThan(20);
    expect(restore.tables.length).toBeGreaterThan(20);
  });

  it('every public table is either backed up or explicitly excluded (no silent omission)', () => {
    const allTables = readAllTableKeys();
    expect(allTables.length).toBeGreaterThan(40); // sanity: parsed the whole Tables block
    // audit_log is range-partitioned by month (audit_log_YYYY_MM) — the partitions
    // are part of the excluded audit_log, not separate durable tables.
    const isAuditPartition = (t: string) => /^audit_log_\d{4}_\d{2}$/.test(t);
    const uncovered = allTables.filter(
      (t) => !backupSet.has(t) && !(t in EXCLUDED_FROM_BACKUP) && !isAuditPartition(t),
    );
    expect(
      uncovered,
      'tables in NEITHER BACKUP_TABLES nor EXCLUDED_FROM_BACKUP — decide: back it up, or document the exclusion (silent-data-loss guard)',
    ).toEqual([]);
  });

  it('no excluded table is also (mistakenly) backed up', () => {
    const both = Object.keys(EXCLUDED_FROM_BACKUP).filter((t) => backupSet.has(t));
    expect(both, 'tables listed as excluded but also in BACKUP_TABLES — contradictory').toEqual([]);
  });

  it('every backed-up table is also restorable (guards the QA-2 silent-data-loss P0)', () => {
    const backedUpButNotRestored = backup.filter((t) => !restoreSet.has(t));
    expect(
      backedUpButNotRestored,
      `tables backed up but missing from restore v_tables (${restore.file}) — these would be silently dropped on restore`,
    ).toEqual([]);
  });

  it('the restore allowlist contains no table that is never backed up', () => {
    const restoredButNotBackedUp = restore.tables.filter((t) => !backupSet.has(t));
    expect(
      restoredButNotBackedUp,
      `tables in restore v_tables (${restore.file}) that are absent from BACKUP_TABLES`,
    ).toEqual([]);
  });

  it('every deleted_at-strip table is part of the restore allowlist', () => {
    const stripNotRestored = restore.deletedAt.filter((t) => !restoreSet.has(t));
    expect(stripNotRestored, 'a table cannot be deleted_at-stripped if it is not restored').toEqual([]);
  });

  it('regression lock: the scenario tables fixed in migration 115 stay restorable', () => {
    expect(restore.tables).toContain('mortgage_scenarios');
    expect(restore.tables).toContain('scenario_tracks');
  });
});
