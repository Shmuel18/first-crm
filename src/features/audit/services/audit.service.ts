import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { formatPersonName } from '@/lib/utils/person-name';

import {
  collectFkIds,
  extractChanges,
  extractWholeRow,
  substituteFkValues,
  type AuditEntry,
  type AuditRow,
} from '../domain/audit-parser';

import { resolveFkDisplayNames } from './audit-fk-resolver';

export type { AuditChangeMap, AuditEntry, AuditFieldChange } from '../domain/audit-parser';

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
      nameById.set(p.id, formatPersonName(p.first_name, p.last_name) || null);
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
  }))
    // Drop UPDATEs whose only changed columns were hidden (e.g. a Drive-sync
    // touch that just rewrote `metadata`) — they carry no displayable diff, so
    // rendering them would leave an empty history row.
    .filter((e) => e.action !== 'UPDATE' || (e.changes !== null && Object.keys(e.changes).length > 0));

  // ── 2. FK display-name enrichment ──────────────────────────────────
  const idsByField = new Map<string, Set<string>>();
  for (const entry of entries) {
    collectFkIds(entry.changes, idsByField);
    collectFkIds(entry.wholeRow, idsByField);
  }

  const lookups = await resolveFkDisplayNames(admin, idsByField, nameById);

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
  opts: { includeFinancials?: boolean } = {},
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
  // Tasks are the only audited child table with row-level privacy
  // (is_private — see tasks_select, migration 159), so their id lookup goes
  // through the VIEWER's client: RLS decides which tasks' audit rows the
  // current user may see on the timeline, and stays in sync with policy
  // changes without duplicating the rule here.
  const viewer = await createClient();

  const [caseBorrowers, banksRes, docsRes, tasksRes] = await Promise.all([
    admin.from('case_borrowers').select('borrower_id').eq('case_id', caseId),
    admin.from('case_banks').select('id').eq('case_id', caseId),
    admin.from('documents').select('id').eq('case_id', caseId),
    // Tasks linked to this case — their audit rows (create / status / assignee /
    // complete / delete) belong on the case timeline too.
    viewer.from('tasks').select('id').eq('case_id', caseId),
  ]);

  const borrowerIds =
    caseBorrowers.data
      ?.map((r) => r.borrower_id)
      .filter((v): v is string => typeof v === 'string') ?? [];
  const bankIds =
    banksRes.data?.map((r) => r.id).filter((v): v is string => typeof v === 'string') ?? [];
  const docIds =
    docsRes.data?.map((r) => r.id).filter((v): v is string => typeof v === 'string') ?? [];
  const taskIds =
    tasksRes.data?.map((r) => r.id).filter((v): v is string => typeof v === 'string') ?? [];

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
    { table: 'tasks', ids: taskIds },
    // case_financials holds the manager-only fee_amount / expected_income
    // (record_id = case_id). Only surface its audit diffs when the caller
    // holds view_case_fee — fail-safe: excluded unless explicitly opted in,
    // so a forgetful caller can't leak those fields to any case-viewer.
    ...(opts.includeFinancials ? [{ table: 'case_financials', ids: [caseId] }] : []),
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

/**
 * Document-only audit timeline for a case: just the `documents` rows belonging
 * to the case (uploads, verifications, deletions). Powers the documents page's
 * scoped "document history" view. Service-role read — the caller must have
 * verified the case is viewable first.
 */
export async function listDocumentAuditForCase(caseId: string, limit = 200): Promise<AuditEntry[]> {
  const admin = createAdminClient();
  const { data: docsRes } = await admin.from('documents').select('id').eq('case_id', caseId);
  const docIds = docsRes?.map((r) => r.id).filter((v): v is string => typeof v === 'string') ?? [];
  if (docIds.length === 0) return [];

  const { data, error } = await admin
    .from('audit_log')
    .select('id, action, table_name, record_id, timestamp, changed_fields, user_id')
    .eq('table_name', 'documents')
    .in('record_id', docIds)
    .order('timestamp', { ascending: false })
    .limit(limit);
  if (error || !data) return [];
  return resolveEntries(data as AuditRow[]);
}
