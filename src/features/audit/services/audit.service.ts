import { createAdminClient } from '@/lib/supabase/admin';

import type { Json } from '@/types/database';

/**
 * Per-field old/new pair for an UPDATE. For INSERT/DELETE the trigger logs
 * the whole row instead, so we expose `wholeRow` (the raw JSONB) for those.
 */
export type AuditFieldChange = { old: Json | null; new: Json | null };
export type AuditChangeMap = Record<string, AuditFieldChange>;

export type AuditEntry = {
  id: string;
  action: string;
  tableName: string;
  recordId: string;
  timestamp: string;
  actorName: string | null;
  /**
   * For UPDATEs: the parsed { field: { old, new } } diff.
   * For INSERT/DELETE: null (the audit row stored the whole record under
   * `wholeRow` instead — useful for showing what was created/removed).
   */
  changes: AuditChangeMap | null;
  /** INSERT/DELETE only — the entire row that was created or removed. */
  wholeRow: Record<string, Json | null> | null;
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

/**
 * For an UPDATE row, the trigger stores `{ field: { old, new } }`. Coerce
 * loose JSONB into our typed shape; entries that don't look like a diff
 * (i.e. INSERT/DELETE rows where the whole row is stored) return null so
 * the caller knows to fall back to `wholeRow`.
 */
function extractChanges(action: string, changed: Json | null): AuditChangeMap | null {
  if (action !== 'UPDATE') return null;
  if (!changed || typeof changed !== 'object' || Array.isArray(changed)) return null;
  const out: AuditChangeMap = {};
  for (const [key, val] of Object.entries(changed)) {
    if (val && typeof val === 'object' && !Array.isArray(val) && 'old' in val && 'new' in val) {
      const pair = val as { old: Json | null; new: Json | null };
      out[key] = { old: pair.old, new: pair.new };
    }
  }
  return Object.keys(out).length > 0 ? out : null;
}

function extractWholeRow(
  action: string,
  changed: Json | null,
): Record<string, Json | null> | null {
  if (action !== 'INSERT' && action !== 'DELETE') return null;
  if (!changed || typeof changed !== 'object' || Array.isArray(changed)) return null;
  return changed as Record<string, Json | null>;
}

/**
 * FK columns we substitute with the referenced row's display name. Keeps
 * the audit log readable — a raw UUID like
 * `7d2e8c4b-...` is meaningless to the office, but the resolved name
 * "אישור עקרוני" is immediately useful.
 *
 * Each entry maps the column name to (target_table, name_column). For
 * profiles the resolver concatenates first+last; everything else just
 * picks `name_he`.
 */
const FK_NAME_LOOKUPS: ReadonlyArray<{
  field: string;
  table: 'case_statuses' | 'case_types' | 'banks' | 'income_types';
  nameColumn: 'name_he';
}> = [
  { field: 'status_id', table: 'case_statuses', nameColumn: 'name_he' },
  { field: 'case_type_primary_id', table: 'case_types', nameColumn: 'name_he' },
  { field: 'case_type_secondary_id', table: 'case_types', nameColumn: 'name_he' },
  { field: 'bank_id', table: 'banks', nameColumn: 'name_he' },
  { field: 'income_type_id', table: 'income_types', nameColumn: 'name_he' },
];

/** Walk a JSONB object collecting any FK ids we know how to resolve. */
function collectFkIds(
  source: AuditChangeMap | Record<string, Json | null> | null,
  acc: Map<string, Set<string>>,
): void {
  if (!source) return;
  for (const [field, val] of Object.entries(source)) {
    if (val === null || val === undefined) continue;
    // UPDATE: { old, new } pair
    if (typeof val === 'object' && !Array.isArray(val) && 'old' in val && 'new' in val) {
      for (const candidate of [val.old, val.new]) {
        if (typeof candidate === 'string' && candidate.length > 0) {
          if (!acc.has(field)) acc.set(field, new Set());
          acc.get(field)!.add(candidate);
        }
      }
      continue;
    }
    // INSERT/DELETE: bare value
    if (typeof val === 'string') {
      if (!acc.has(field)) acc.set(field, new Set());
      acc.get(field)!.add(val);
    }
  }
}

/** Mutate a JSONB object in-place, replacing FK ids with their resolved
 *  display name when available. Leaves unknown ids untouched. */
function substituteFkValues(
  source: AuditChangeMap | Record<string, Json | null> | null,
  lookups: Map<string, Map<string, string>>,
): void {
  if (!source) return;
  for (const [field, val] of Object.entries(source)) {
    const lookup = lookups.get(field);
    if (!lookup) continue;
    if (val && typeof val === 'object' && !Array.isArray(val) && 'old' in val && 'new' in val) {
      const pair = val as AuditFieldChange;
      if (typeof pair.old === 'string') pair.old = lookup.get(pair.old) ?? pair.old;
      if (typeof pair.new === 'string') pair.new = lookup.get(pair.new) ?? pair.new;
      continue;
    }
    if (typeof val === 'string') {
      (source as Record<string, Json | null>)[field] = lookup.get(val) ?? val;
    }
  }
}

/** Resolve actor names and FK display names, then map raw audit rows to
 *  display entries. Two passes: build entries → enrich changes/wholeRow with
 *  FK lookups. Keeps the entry-mapping logic simple and lets the FK pass
 *  batch the lookups across all entries. */
async function resolveEntries(rows: AuditRow[]): Promise<AuditEntry[]> {
  if (rows.length === 0) return [];
  const admin = createAdminClient();

  // ── 1. Actor name lookup ────────────────────────────────────────────
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

  const entries: AuditEntry[] = rows.map((row) => ({
    id: row.id,
    action: row.action,
    tableName: row.table_name,
    recordId: row.record_id,
    timestamp: row.timestamp,
    actorName: row.user_id ? nameById.get(row.user_id) ?? null : null,
    changes: extractChanges(row.action, row.changed_fields),
    wholeRow: extractWholeRow(row.action, row.changed_fields),
  }));

  // ── 2. FK display-name enrichment ──────────────────────────────────
  const idsByField = new Map<string, Set<string>>();
  for (const entry of entries) {
    collectFkIds(entry.changes, idsByField);
    collectFkIds(entry.wholeRow, idsByField);
  }
  // Also resolve assigned_advisor_id from the profiles map we already fetched
  // — no extra query needed since users are typically advisors too. For ids
  // not in the map, leave the UUID (rare: deleted users).
  const advisorIds = idsByField.get('assigned_advisor_id');
  if (advisorIds && advisorIds.size > 0) {
    const missing = [...advisorIds].filter((id) => !nameById.has(id));
    if (missing.length > 0) {
      const { data: extraProfiles } = await admin
        .from('profiles')
        .select('id, first_name, last_name')
        .in('id', missing);
      for (const p of extraProfiles ?? []) {
        nameById.set(p.id, [p.first_name, p.last_name].filter(Boolean).join(' ').trim() || null);
      }
    }
  }

  const lookups = new Map<string, Map<string, string>>();
  if (advisorIds && advisorIds.size > 0) {
    const advisorLookup = new Map<string, string>();
    for (const id of advisorIds) {
      const name = nameById.get(id);
      if (name) advisorLookup.set(id, name);
    }
    if (advisorLookup.size > 0) lookups.set('assigned_advisor_id', advisorLookup);
  }

  await Promise.all(
    FK_NAME_LOOKUPS.map(async ({ field, table, nameColumn }) => {
      const ids = idsByField.get(field);
      if (!ids || ids.size === 0) return;
      const { data } = await admin.from(table).select(`id, ${nameColumn}`).in('id', [...ids]);
      if (!data) return;
      const map = new Map<string, string>();
      for (const row of data as Array<Record<string, unknown>>) {
        const id = row.id;
        const name = row[nameColumn];
        if (typeof id === 'string' && typeof name === 'string') map.set(id, name);
      }
      if (map.size > 0) lookups.set(field, map);
    }),
  );

  for (const entry of entries) {
    substituteFkValues(entry.changes, lookups);
    substituteFkValues(entry.wholeRow, lookups);
  }

  return entries;
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
 * Audit entries for a case AND every entity that belongs to it: the case row
 * itself, its borrowers, those borrowers' incomes/obligations, the case's
 * banks, documents, and financials row. Merged into one timeline sorted by
 * timestamp DESC. Reads via the service-role client so the audit_log RLS
 * doesn't get in the way — the caller must have verified the case is
 * viewable first (e.g. via getCaseById returning truthy).
 *
 * Performance: 6 quick id-lookup queries in parallel + N audit_log scans
 * (one per non-empty target). Each audit query is itself bounded by `limit`
 * so worst case is bounded too. The merged set is sorted in JS and trimmed.
 */
export async function listAuditEntriesForCase(
  caseId: string,
  limit = 200,
): Promise<AuditEntry[]> {
  const admin = createAdminClient();

  // Step 1: collect the (table_name, id[]) pairs we need to scan in audit_log.
  // Run the id-lookup queries that don't depend on borrower_ids in parallel,
  // then chase the incomes/obligations once borrower_ids land.
  //
  // case_financials note: the table uses case_id as its PK (no `id` column).
  // Migration 054 added a dedicated trigger keyed off case_id, so audit rows
  // for fee_amount / expected_income changes land with record_id=caseId.
  // Querying by record_id=caseId here surfaces them in the case timeline
  // without an extra join.
  const [caseBorrowers, banksRes, docsRes] = await Promise.all([
    admin.from('case_borrowers').select('borrower_id').eq('case_id', caseId),
    admin.from('case_banks').select('id').eq('case_id', caseId),
    admin.from('documents').select('id').eq('case_id', caseId),
  ]);

  const borrowerIds =
    caseBorrowers.data
      ?.map((r) => r.borrower_id)
      .filter((v): v is string => typeof v === 'string') ?? [];
  const bankIds =
    banksRes.data?.map((r) => r.id).filter((v): v is string => typeof v === 'string') ?? [];
  const docIds =
    docsRes.data?.map((r) => r.id).filter((v): v is string => typeof v === 'string') ?? [];

  // Incomes & obligations live one hop further — borrower_id is the link.
  const [incomesRes, obligationsRes] = await Promise.all([
    borrowerIds.length > 0
      ? admin.from('borrower_incomes').select('id').in('borrower_id', borrowerIds)
      : Promise.resolve({ data: [] as { id: string }[] }),
    borrowerIds.length > 0
      ? admin.from('borrower_obligations').select('id').in('borrower_id', borrowerIds)
      : Promise.resolve({ data: [] as { id: string }[] }),
  ]);
  const incomeIds =
    incomesRes.data?.map((r) => r.id).filter((v): v is string => typeof v === 'string') ?? [];
  const obligationIds =
    obligationsRes.data
      ?.map((r) => r.id)
      .filter((v): v is string => typeof v === 'string') ?? [];

  type Target = { table: string; ids: string[] };
  const targets: Target[] = [
    { table: 'cases', ids: [caseId] },
    { table: 'borrowers', ids: borrowerIds },
    { table: 'borrower_incomes', ids: incomeIds },
    { table: 'borrower_obligations', ids: obligationIds },
    { table: 'case_banks', ids: bankIds },
    { table: 'documents', ids: docIds },
    // case_financials uses case_id as record_id (see comment above).
    { table: 'case_financials', ids: [caseId] },
  ].filter((t) => t.ids.length > 0);

  // Step 2: query audit_log for each target table+ids in parallel.
  const results = await Promise.all(
    targets.map(({ table, ids }) =>
      admin
        .from('audit_log')
        .select('id, action, table_name, record_id, timestamp, changed_fields, user_id')
        .eq('table_name', table)
        .in('record_id', ids)
        .order('timestamp', { ascending: false })
        .limit(limit),
    ),
  );

  // Step 3: merge, sort DESC by ISO timestamp string (lexicographic == temporal
  // for ISO-8601), trim to `limit`, then resolve actor names.
  const merged: AuditRow[] = [];
  for (const r of results) {
    if (r.data) merged.push(...(r.data as AuditRow[]));
  }
  // ISO-8601 timestamps sort lexicographically the same way they sort
  // temporally — `localeCompare` is clearer than a three-way ternary.
  merged.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
  const top = merged.slice(0, limit);

  return resolveEntries(top);
}
