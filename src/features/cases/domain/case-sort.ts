/**
 * Dashboard sort state — column-header sorting (Excel/Sheets-style).
 *
 * Sortable keys:
 *   - name       : surname then first name of the primary borrower.
 *   - stage      : pipeline order (status.sort_order).
 *   - targetDate : nearest deadline first.
 *   - opened     : case-opening order — the DB order, which `listCases`
 *                  returns oldest-first (the pre-2026-10 default view).
 *
 * When no sort is active the dashboard sorts by URGENCY (Kaufman, 2026-10):
 * dated cases by target date (overdue first), then undated ones in opening
 * order. Cancelling a column sort returns to this default.
 *
 * הוצא לבחינה and then ביצוע cases sink to the bottom in the urgency / opened /
 * targetDate views — nothing is left for the advisor to chase on them. The explicit name and stage sorts don't
 * move them: those are lookups, and stage order already places ביצוע.
 *
 * Empty / missing keys (case with no borrowers, no stage) always sink
 * to the bottom — independent of the sort direction. Direction is
 * applied to the body of the comparison only after the empty checks
 * have already returned.
 */

import { getPrimaryBorrowerSortKey } from './case-derivations';
import { compareTargetDates } from './target-date';

import type { CaseWithRelations } from '../types';

export const SORT_COLUMNS = ['name', 'stage', 'targetDate', 'opened'] as const;
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

/**
 * How far a case sinks: 0 for the working pipeline, 1 for הוצא לבחינה, 2 for
 * ביצוע (the very bottom). Both are past the advisor's own work (Kaufman,
 * 2026-10), and הוצא לבחינה still precedes ביצוע in the process.
 */
function sinkRank(c: CaseWithRelations): number {
  const key = c.status?.key;
  return key === 'execution' ? 2 : key === 'sent_for_review' ? 1 : 0;
}

/**
 * Default view. Relies on Array.prototype.sort being stable: the input
 * arrives in opening order, so cases with an equal key (same date, or no
 * date) keep that order.
 */
function sortByUrgency(cases: ReadonlyArray<CaseWithRelations>): CaseWithRelations[] {
  return [...cases].sort(
    (a, b) =>
      sinkRank(a) - sinkRank(b) || compareTargetDates(a.target_date, b.target_date),
  );
}

/** Opening order = the incoming DB order; desc simply reverses it. */
function sortByOpened(cases: ReadonlyArray<CaseWithRelations>, dir: SortDir): CaseWithRelations[] {
  const ordered = dir === 'desc' ? [...cases].reverse() : [...cases];
  return ordered.sort((a, b) => sinkRank(a) - sinkRank(b));
}

export function applySort(
  cases: ReadonlyArray<CaseWithRelations>,
  sort: CaseSort | null,
  statusOptions: ReadonlyArray<StatusRef>,
): CaseWithRelations[] {
  if (cases.length === 0) return [];
  if (!sort) return sortByUrgency(cases);
  if (sort.column === 'opened') return sortByOpened(cases, sort.dir);

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
        return (
          sinkRank(a) - sinkRank(b) || (sort.dir === 'desc' ? -cmp : cmp) || tieBySurname(a, b)
        );
      });
      break;
  }
  return sorted;
}
