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

  // Profile lookups (assigned_advisor_id) fold in directly from the actor
  // names we already fetched. Missing entries get a single fill-in query.
  const advisorIds = idsByField.get('assigned_advisor_id');
  if (advisorIds && advisorIds.size > 0) {
    const missing = [...advisorIds].filter((id) => !nameById.has(id));
    if (missing.length > 0) {
      const { data: extraProfiles } = await admin
        .from('profiles')
        .select('id, first_name, last_name')
        .in('id', missing);
      for (const p of extraProfiles ?? []) {
        nameById.set(p.id, formatPersonName(p.first_name, p.last_name) || null);
      }
    }
    const advisorLookup = new Map<string, string>();
    for (const id of advisorIds) {
      const name = nameById.get(id);
      if (name) advisorLookup.set(id, name);
    }
    if (advisorLookup.size > 0) lookups.set('assigned_advisor_id', advisorLookup);
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
