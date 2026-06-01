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

describe('backup <-> restore allowlist parity', () => {
  const backup = readBackupTables();
  const restore = readRestoreLists();
  const backupSet = new Set(backup);
  const restoreSet = new Set(restore.tables);

  it('parses non-empty allowlists from both sources', () => {
    expect(backup.length).toBeGreaterThan(20);
    expect(restore.tables.length).toBeGreaterThan(20);
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
