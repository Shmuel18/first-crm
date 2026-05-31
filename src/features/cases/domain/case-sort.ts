/**
 * Dashboard sort state — column-header sorting (Excel/Sheets-style).
 *
 * Two sortable columns:
 *   - name  : surname then first name of the primary borrower.
 *   - stage : pipeline order (status.sort_order).
 *
 * Everything else — including the # column — is non-sortable. When no
 * sort is active the table shows cases in the DB-returned order, which
 * `listCases` orders oldest-first (the dashboard reads top-down as a
 * timeline). Cancelling a column sort returns to this default.
 *
 * Empty / missing keys (case with no borrowers, no stage) always sink
 * to the bottom — independent of the sort direction. Direction is
 * applied to the body of the comparison only after the empty checks
 * have already returned.
 */

import { getPrimaryBorrowerSortKey } from './case-derivations';
import { compareTargetDates } from './target-date';

import type { CaseWithRelations } from '../types';

export const SORT_COLUMNS = ['name', 'stage', 'targetDate'] as const;
export type SortColumn = (typeof SORT_COLUMNS)[number];
export type SortDir = 'asc' | 'desc';

export type CaseSort = { column: SortColumn; dir: SortDir };

type StatusRef = { id: string; sort_order: number };

function first(v: string | string[] | undefined): string | null {
  return (Array.isArray(v) ? v[0] : v) ?? null;
}

/** Returns the active sort, or null when no sort URL params are set. */
export function parseCaseSort(
  sp: Record<string, string | string[] | undefined>,
): CaseSort | null {
  const col = first(sp.sort);
  if (!(SORT_COLUMNS as readonly string[]).includes(col ?? '')) return null;
  const dir = first(sp.dir);
  return {
    column: col as SortColumn,
    dir: dir === 'desc' ? 'desc' : 'asc',
  };
}

/** String comparator that pins empty values to the end (always). */
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

function stagePos(c: CaseWithRelations, order: Map<string, number>): number {
  return c.status?.id ? order.get(c.status.id) ?? Number.POSITIVE_INFINITY : Number.POSITIVE_INFINITY;
}

export function applySort(
  cases: ReadonlyArray<CaseWithRelations>,
  sort: CaseSort | null,
  statusOptions: ReadonlyArray<StatusRef>,
): CaseWithRelations[] {
  if (cases.length === 0) return [];
  if (!sort) return [...cases]; // no active sort — keep the DB order

  const sorted = [...cases];
  // Secondary tiebreaker — always asc surname.
  const tieBySurname = (a: CaseWithRelations, b: CaseWithRelations) =>
    cmpStr(getPrimaryBorrowerSortKey(a), getPrimaryBorrowerSortKey(b), 'asc');

  switch (sort.column) {
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
    case 'targetDate':
      sorted.sort((a, b) => {
        const cmp = compareTargetDates(a.target_date, b.target_date);
        return (sort.dir === 'desc' ? -cmp : cmp) || tieBySurname(a, b);
      });
      break;
  }
  return sorted;
}
