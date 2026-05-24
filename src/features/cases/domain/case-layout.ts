/**
 * Dashboard layout presets — pure sort orderings of the case list.
 *
 * Three views, each returning the same set of cases in a different order:
 *   - default       : updated_at DESC (already how the DB returns them)
 *   - alphabetical  : last name then first name of the primary borrower
 *   - by-stage      : pipeline order; within a stage, A-B by last name
 *
 * No grouping, no section headers — the table stays a flat list.
 */

import { getPrimaryBorrowerSortKey } from './case-derivations';

import type { CaseWithRelations } from '../types';

export const CASE_LAYOUTS = ['default', 'alphabetical', 'by-stage'] as const;

export type CaseLayout = (typeof CASE_LAYOUTS)[number];

type StatusRef = { id: string; sort_order: number };

function first(v: string | string[] | undefined): string | null {
  return (Array.isArray(v) ? v[0] : v) ?? null;
}

export function parseCaseLayout(
  sp: Record<string, string | string[] | undefined>,
): CaseLayout {
  const v = first(sp.layout);
  return (CASE_LAYOUTS as readonly string[]).includes(v ?? '')
    ? (v as CaseLayout)
    : 'default';
}

/** Hebrew-aware A-B comparator. Empty keys sort to the end. */
function compareSortKeys(a: string, b: string): number {
  if (!a && !b) return 0;
  if (!a) return 1;
  if (!b) return -1;
  return a.localeCompare(b, 'he', { sensitivity: 'base' });
}

export function applyLayout(
  cases: ReadonlyArray<CaseWithRelations>,
  layout: CaseLayout,
  statusOptions: ReadonlyArray<StatusRef>,
): CaseWithRelations[] {
  if (cases.length === 0) return [];
  if (layout === 'default') return [...cases]; // already updated_at DESC from the DB

  const byLastName = (a: CaseWithRelations, b: CaseWithRelations) =>
    compareSortKeys(getPrimaryBorrowerSortKey(a), getPrimaryBorrowerSortKey(b));

  const sorted = [...cases];
  switch (layout) {
    case 'alphabetical':
      sorted.sort(byLastName);
      break;
    case 'by-stage': {
      const stageOrder = new Map(statusOptions.map((s) => [s.id, s.sort_order]));
      const stagePos = (c: CaseWithRelations) =>
        c.status?.id
          ? stageOrder.get(c.status.id) ?? Number.POSITIVE_INFINITY
          : Number.POSITIVE_INFINITY;
      sorted.sort((a, b) => stagePos(a) - stagePos(b) || byLastName(a, b));
      break;
    }
  }
  return sorted;
}
