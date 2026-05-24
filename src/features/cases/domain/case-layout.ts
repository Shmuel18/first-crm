/**
 * Dashboard layout presets — pure sort orderings of the case list.
 *
 * Four views, each returning the same set of cases in a different order:
 *   - newest       : created_at DESC (case-opening date, newest first)
 *   - oldest       : created_at ASC  (oldest case first)
 *   - alphabetical : last name then first name of the primary borrower
 *   - by-stage     : pipeline order; within a stage, A-B by surname
 *
 * Sorting is by created_at (when the case was opened), NOT updated_at —
 * so editing a case won't bounce its row to the top of the list. No
 * grouping, no section headers — the table stays a flat list.
 */

import { getPrimaryBorrowerSortKey } from './case-derivations';

import type { CaseWithRelations } from '../types';

export const CASE_LAYOUTS = ['newest', 'oldest', 'alphabetical', 'by-stage'] as const;

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
    : 'newest';
}

/** Hebrew-aware A-B comparator. Empty keys sort to the end. */
function compareSortKeys(a: string, b: string): number {
  if (!a && !b) return 0;
  if (!a) return 1;
  if (!b) return -1;
  return a.localeCompare(b, 'he', { sensitivity: 'base' });
}

function compareByCreatedAt(
  a: CaseWithRelations,
  b: CaseWithRelations,
  direction: 'desc' | 'asc',
): number {
  // ISO timestamps sort lexicographically, so a simple string compare works.
  const ac = a.created_at ?? '';
  const bc = b.created_at ?? '';
  if (ac === bc) return 0;
  return direction === 'desc' ? (bc < ac ? -1 : 1) : ac < bc ? -1 : 1;
}

export function applyLayout(
  cases: ReadonlyArray<CaseWithRelations>,
  layout: CaseLayout,
  statusOptions: ReadonlyArray<StatusRef>,
): CaseWithRelations[] {
  if (cases.length === 0) return [];

  const byLastName = (a: CaseWithRelations, b: CaseWithRelations) =>
    compareSortKeys(getPrimaryBorrowerSortKey(a), getPrimaryBorrowerSortKey(b));

  const sorted = [...cases];
  switch (layout) {
    case 'newest':
      sorted.sort((a, b) => compareByCreatedAt(a, b, 'desc') || byLastName(a, b));
      break;
    case 'oldest':
      sorted.sort((a, b) => compareByCreatedAt(a, b, 'asc') || byLastName(a, b));
      break;
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
