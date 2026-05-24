/**
 * Dashboard sort state — column-header sorting (Excel/Sheets-style).
 *
 * Three sortable columns:
 *   - created : case-opening date. Doubles as the # column header
 *               (newest first by default).
 *   - name    : surname then first name of the primary borrower.
 *   - stage   : pipeline order (status.sort_order).
 *
 * Bank and advisor columns are intentionally NOT sortable — both have
 * narrow practical use (a manager rarely sorts by either) and keeping
 * them inert keeps the header row visually quieter.
 *
 * Empty / missing keys (case with no borrowers, no stage) always sink
 * to the bottom — independent of the sort direction. The naive
 * "multiply by -1 for desc" approach also flips that handling, which
 * is why we apply direction to the body of the comparison only after
 * the empty-checks have already returned.
 */

import { getPrimaryBorrowerSortKey } from './case-derivations';

import type { CaseWithRelations } from '../types';

export const SORT_COLUMNS = ['created', 'name', 'stage'] as const;
export type SortColumn = (typeof SORT_COLUMNS)[number];
export type SortDir = 'asc' | 'desc';

export type CaseSort = { column: SortColumn; dir: SortDir };

export const DEFAULT_SORT: CaseSort = { column: 'created', dir: 'desc' };

type StatusRef = { id: string; sort_order: number };

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

/**
 * String comparator that pins empty values to the end (always), then applies
 * direction to the body of the comparison.
 */
function cmpStr(a: string, b: string, dir: SortDir): number {
  if (!a && !b) return 0;
  if (!a) return 1;
  if (!b) return -1;
  const cmp = a.localeCompare(b, 'he', { sensitivity: 'base' });
  return dir === 'desc' ? -cmp : cmp;
}

/** Same idea for numeric keys (stage position). Infinity = "missing" → end. */
function cmpNum(a: number, b: number, dir: SortDir): number {
  const aInf = !Number.isFinite(a);
  const bInf = !Number.isFinite(b);
  if (aInf && bInf) return 0;
  if (aInf) return 1;
  if (bInf) return -1;
  if (a === b) return 0;
  const cmp = a < b ? -1 : 1;
  return dir === 'desc' ? -cmp : cmp;
}

/** ISO timestamps sort lexicographically — same treatment as cmpStr. */
function cmpDate(a: string, b: string, dir: SortDir): number {
  if (!a && !b) return 0;
  if (!a) return 1;
  if (!b) return -1;
  if (a === b) return 0;
  const cmp = a < b ? -1 : 1;
  return dir === 'desc' ? -cmp : cmp;
}

function stagePos(c: CaseWithRelations, order: Map<string, number>): number {
  return c.status?.id ? order.get(c.status.id) ?? Number.POSITIVE_INFINITY : Number.POSITIVE_INFINITY;
}

export function applySort(
  cases: ReadonlyArray<CaseWithRelations>,
  sort: CaseSort,
  statusOptions: ReadonlyArray<StatusRef>,
): CaseWithRelations[] {
  if (cases.length === 0) return [];

  const sorted = [...cases];
  // Secondary tiebreaker — always asc surname, so equal primary keys keep a
  // predictable A-B order regardless of the primary direction.
  const tieBySurname = (a: CaseWithRelations, b: CaseWithRelations) =>
    cmpStr(getPrimaryBorrowerSortKey(a), getPrimaryBorrowerSortKey(b), 'asc');

  switch (sort.column) {
    case 'created':
      sorted.sort(
        (a, b) => cmpDate(a.created_at ?? '', b.created_at ?? '', sort.dir) || tieBySurname(a, b),
      );
      break;
    case 'name':
      sorted.sort((a, b) =>
        cmpStr(getPrimaryBorrowerSortKey(a), getPrimaryBorrowerSortKey(b), sort.dir),
      );
      break;
    case 'stage': {
      const order = new Map(statusOptions.map((s) => [s.id, s.sort_order]));
      sorted.sort(
        (a, b) => cmpNum(stagePos(a, order), stagePos(b, order), sort.dir) || tieBySurname(a, b),
      );
      break;
    }
  }
  return sorted;
}
