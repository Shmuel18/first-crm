/**
 * Dashboard sort state — replaces the old "layout preset" dropdown with
 * column-header sorting (Excel/Sheets-style).
 *
 * Five sortable columns:
 *   - created : case-opening date. Doubles as the # column header
 *               (newest first by default).
 *   - name    : surname then first name of the primary borrower.
 *   - stage   : pipeline order (status.sort_order).
 *   - bank    : alphabetical by primary bank name.
 *   - advisor : alphabetical by advisor name.
 *
 * Cases missing the sort key (no advisor, no primary bank) sink to the
 * end via a Unicode sentinel that sorts last under localeCompare.
 */

import { getPrimaryBank, getPrimaryBorrowerSortKey } from './case-derivations';

import type { CaseWithRelations } from '../types';

export const SORT_COLUMNS = ['created', 'name', 'stage', 'bank', 'advisor'] as const;
export type SortColumn = (typeof SORT_COLUMNS)[number];
export type SortDir = 'asc' | 'desc';

export type CaseSort = { column: SortColumn; dir: SortDir };

export const DEFAULT_SORT: CaseSort = { column: 'created', dir: 'desc' };

type StatusRef = { id: string; sort_order: number };

// Unicode sentinel — sorts after any real character in localeCompare.
const LAST = '￿';

function first(v: string | string[] | undefined): string | null {
  return (Array.isArray(v) ? v[0] : v) ?? null;
}

export function parseCaseSort(
  sp: Record<string, string | string[] | undefined>,
): CaseSort {
  const col = first(sp.sort);
  const dir = first(sp.dir);
  return {
    column: (SORT_COLUMNS as readonly string[]).includes(col ?? '')
      ? (col as SortColumn)
      : DEFAULT_SORT.column,
    dir: dir === 'asc' || dir === 'desc' ? dir : DEFAULT_SORT.dir,
  };
}

function compareSortKeys(a: string, b: string): number {
  if (!a && !b) return 0;
  if (!a) return 1;
  if (!b) return -1;
  return a.localeCompare(b, 'he', { sensitivity: 'base' });
}

function advisorName(c: CaseWithRelations): string {
  return (
    [c.assigned_advisor?.first_name, c.assigned_advisor?.last_name]
      .filter(Boolean)
      .join(' ')
      .trim() || LAST
  );
}

function bankName(c: CaseWithRelations): string {
  return getPrimaryBank(c)?.name_he ?? LAST;
}

function compareByCreatedAt(a: CaseWithRelations, b: CaseWithRelations): number {
  // ISO timestamps sort lexicographically.
  const ac = a.created_at ?? '';
  const bc = b.created_at ?? '';
  if (ac === bc) return 0;
  return ac < bc ? -1 : 1;
}

export function applySort(
  cases: ReadonlyArray<CaseWithRelations>,
  sort: CaseSort,
  statusOptions: ReadonlyArray<StatusRef>,
): CaseWithRelations[] {
  if (cases.length === 0) return [];

  const sorted = [...cases];
  const mult = sort.dir === 'desc' ? -1 : 1;

  // Secondary key — surname A-B — so equal primary keys still get a stable
  // human-friendly order, in both directions.
  const bySurname = (a: CaseWithRelations, b: CaseWithRelations) =>
    compareSortKeys(getPrimaryBorrowerSortKey(a), getPrimaryBorrowerSortKey(b));

  switch (sort.column) {
    case 'created':
      sorted.sort((a, b) => mult * compareByCreatedAt(a, b) || bySurname(a, b));
      break;
    case 'name':
      sorted.sort((a, b) => mult * bySurname(a, b));
      break;
    case 'stage': {
      const stageOrder = new Map(statusOptions.map((s) => [s.id, s.sort_order]));
      const stagePos = (c: CaseWithRelations) =>
        c.status?.id
          ? stageOrder.get(c.status.id) ?? Number.POSITIVE_INFINITY
          : Number.POSITIVE_INFINITY;
      sorted.sort((a, b) => mult * (stagePos(a) - stagePos(b)) || bySurname(a, b));
      break;
    }
    case 'bank':
      sorted.sort(
        (a, b) => mult * compareSortKeys(bankName(a), bankName(b)) || bySurname(a, b),
      );
      break;
    case 'advisor':
      sorted.sort(
        (a, b) => mult * compareSortKeys(advisorName(a), advisorName(b)) || bySurname(a, b),
      );
      break;
  }
  return sorted;
}
