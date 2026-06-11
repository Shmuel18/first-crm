import type { SupabaseClient } from '@supabase/supabase-js';

import { formatPersonName } from '@/lib/utils/person-name';
import type { Database } from '@/types/database';

/**
 * FK columns we substitute with the referenced row's display name. Keeps
 * the audit log readable — a raw UUID like
 * `7d2e8c4b-...` is meaningless to the office, but the resolved name
 * "אישור עקרוני" is immediately useful.
 *
 * Each entry maps the column name to (target_table, name_column). Profile
 * lookups (assigned_advisor_id) are handled separately because they need
 * first+last concatenation, not a simple name column.
 */
const FK_NAME_LOOKUPS: ReadonlyArray<{
  field: string;
  table: 'case_statuses' | 'case_types' | 'banks' | 'income_types' | 'document_categories';
  nameColumn: 'name_he';
}> = [
  { field: 'status_id', table: 'case_statuses', nameColumn: 'name_he' },
  { field: 'case_type_primary_id', table: 'case_types', nameColumn: 'name_he' },
  { field: 'case_type_secondary_id', table: 'case_types', nameColumn: 'name_he' },
  { field: 'bank_id', table: 'banks', nameColumn: 'name_he' },
  { field: 'income_type_id', table: 'income_types', nameColumn: 'name_he' },
  { field: 'category_id', table: 'document_categories', nameColumn: 'name_he' },
];

/**
 * Given the FK ids collected across all audit entries, fetch the display
 * names from the referenced tables in parallel and return a lookup
 * `Map<field, Map<id, display_name>>`. Pass a pre-populated `nameById`
 * for profile (advisor) ids to fold them into the result under
 * 'assigned_advisor_id' without an extra query.
 */
export async function resolveFkDisplayNames(
  admin: SupabaseClient<Database>,
  idsByField: Map<string, Set<string>>,
  nameById: Map<string, string | null>,
): Promise<Map<string, Map<string, string>>> {
  const lookups = new Map<string, Map<string, string>>();

  // Columns that hold a profile id and should resolve to a person's name —
  // the case's responsible advisor plus the task who/whom columns (so a task's
  // reassign / completion shows a name, not a raw UUID, in the case timeline).
  const PROFILE_FIELDS = ['assigned_advisor_id', 'assigned_to', 'completed_by', 'created_by'] as const;

  // Gather every profile id referenced across those fields, backfill the names
  // we don't already have in ONE query, then build a per-field id→name lookup.
  const allProfileIds = new Set<string>();
  for (const field of PROFILE_FIELDS) {
    const ids = idsByField.get(field);
    if (ids) for (const id of ids) allProfileIds.add(id);
  }
  const missing = [...allProfileIds].filter((id) => !nameById.has(id));
  if (missing.length > 0) {
    const { data: extraProfiles } = await admin
      .from('profiles')
      .select('id, first_name, last_name')
      .in('id', missing);
    for (const p of extraProfiles ?? []) {
      nameById.set(p.id, formatPersonName(p.first_name, p.last_name) || null);
    }
  }
  for (const field of PROFILE_FIELDS) {
    const ids = idsByField.get(field);
    if (!ids || ids.size === 0) continue;
    const lookup = new Map<string, string>();
    for (const id of ids) {
      const name = nameById.get(id);
      if (name) lookup.set(id, name);
    }
    if (lookup.size > 0) lookups.set(field, lookup);
  }

  // Columns that hold a borrower id — resolved to the borrower's name so
  // "primary borrower changed" diffs and income/obligation rows read as
  // people, not raw UUIDs. Like profiles, borrowers need first+last
  // concatenation, so they can't ride the static single-column lookups.
  const BORROWER_FIELDS = ['borrower_id', 'primary_borrower_id'] as const;
  const allBorrowerIds = new Set<string>();
  for (const field of BORROWER_FIELDS) {
    const ids = idsByField.get(field);
    if (ids) for (const id of ids) allBorrowerIds.add(id);
  }
  if (allBorrowerIds.size > 0) {
    const { data: borrowerRows } = await admin
      .from('borrowers')
      .select('id, first_name, last_name')
      .in('id', [...allBorrowerIds]);
    const borrowerNameById = new Map<string, string>();
    for (const b of borrowerRows ?? []) {
      const name = formatPersonName(b.first_name, b.last_name);
      if (name) borrowerNameById.set(b.id, name);
    }
    for (const field of BORROWER_FIELDS) {
      const ids = idsByField.get(field);
      if (!ids || ids.size === 0) continue;
      const lookup = new Map<string, string>();
      for (const id of ids) {
        const name = borrowerNameById.get(id);
        if (name) lookup.set(id, name);
      }
      if (lookup.size > 0) lookups.set(field, lookup);
    }
  }

  // Static-FK lookups run in parallel — each is one IN-clause query.
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

  return lookups;
}
