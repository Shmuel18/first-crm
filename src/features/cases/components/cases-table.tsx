'use client';

import { useEffect, useMemo, useRef } from 'react';

import { useTranslations } from 'next-intl';
import { parseAsStringEnum, useQueryState } from 'nuqs';

import { toRowData } from '../domain/case-row-data';
import {
  applySort,
  SORT_COLUMNS,
  type CaseSort,
  type SortColumn,
  type SortDir,
} from '../domain/case-sort';
import type { CaseEditGate } from '../domain/case-edit-gate';
import { useCaseQueryFilter } from '../hooks/use-case-query-filter';
import { useRowDensity } from '../hooks/use-row-density';
import type { CaseWithRelations } from '../types';

import { CaseTableRow } from './case-table-row';
import { SortableTh, Th } from './cases-table-headers';
import { ClearFiltersButton } from './clear-filters-button';

type StatusOption = { id: string; name_he: string; color: string; sort_order: number };
type BankOption = { id: string; key: string; name_he: string; color: string; logo_url: string | null };
type AdvisorOption = { id: string; first_name: string | null; last_name: string | null };

type Props = {
  cases: ReadonlyArray<CaseWithRelations>;
  statusOptions: ReadonlyArray<StatusOption>;
  bankOptions: ReadonlyArray<BankOption>;
  advisorOptions: ReadonlyArray<AdvisorOption>;
  // The advisor column only renders for users who can see other advisors'
  // cases (view_all_cases). A regular advisor sees only their own cases, so
  // the column would always be "themselves" — pure noise. Mirrors the
  // advisor filter, which is already gated the same way.
  canViewAll: boolean;
  // Inline-edit authority for the row cells (separate from canViewAll).
  editGate: CaseEditGate;
  // Manager-only: case ids to flag with the unread star. Empty otherwise.
  unreadCaseIds?: ReadonlyArray<string>;
};

const SORT_DIRS: SortDir[] = ['asc', 'desc'];

// localStorage key for the user's last sort preference. Restored on mount when
// the URL is empty (e.g. after navigating back via the sidebar's bare /cases
// link), and kept in sync whenever the URL sort changes. Cancelling the sort
// via the 3-state header cycle clears the saved preference too.
const SORT_STORAGE_KEY = 'kaufman:dashboard:case-sort';

function readSavedSort(): { col: SortColumn; dir: SortDir } | null {
  if (typeof window === 'undefined') return null;
  const raw = window.localStorage.getItem(SORT_STORAGE_KEY);
  if (!raw) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null) return null;
    const { col, dir } = parsed as { col?: unknown; dir?: unknown };
    if (typeof col !== 'string' || typeof dir !== 'string') return null;
    if (!(SORT_COLUMNS as readonly string[]).includes(col)) return null;
    if (!(SORT_DIRS as readonly string[]).includes(dir)) return null;
    return { col: col as SortColumn, dir: dir as SortDir };
  } catch {
    window.localStorage.removeItem(SORT_STORAGE_KEY);
    return null;
  }
}

export function CasesTable({ cases, statusOptions, bankOptions, advisorOptions, canViewAll, editGate, unreadCaseIds }: Props) {
  const t = useTranslations('dashboard.columns');
  const tf = useTranslations('dashboard.filters');
  const filtered = useCaseQueryFilter(cases);
  const density = useRowDensity();
  const unreadSet = useMemo(() => new Set(unreadCaseIds ?? []), [unreadCaseIds]);

  // Sort is opt-in: URL is clean → null → table keeps its incoming order
  // (which `listCases` returns newest-first). Click a header to activate.
  const [sortCol, setSortCol] = useQueryState(
    'sort',
    parseAsStringEnum([...SORT_COLUMNS]).withOptions({ shallow: true }),
  );
  const [sortDirRaw, setSortDir] = useQueryState(
    'dir',
    parseAsStringEnum(SORT_DIRS).withOptions({ shallow: true }),
  );

  // Build the sort object inside useMemo so its parts are the explicit deps —
  // no `eslint-disable` and no leaky reference held outside.
  const ordered = useMemo(() => {
    const sort: CaseSort | null = sortCol
      ? { column: sortCol, dir: sortDirRaw ?? 'asc' }
      : null;
    return applySort(filtered, sort, statusOptions);
  }, [filtered, sortCol, sortDirRaw, statusOptions]);

  // For the header components (which need to highlight the active arrow).
  const sortForHeaders: CaseSort | null = sortCol
    ? { column: sortCol, dir: sortDirRaw ?? 'asc' }
    : null;

  const densityClass =
    density === 'compact'
      ? '[&_td]:h-10 [&_td]:py-1.5'
      : density === 'comfortable'
        ? '[&_td]:h-16 [&_td]:py-4'
        : '[&_td]:h-14';

  const handleSort = (column: SortColumn) => {
    if (column !== sortCol) {
      setSortCol(column);
      setSortDir('asc');
      return;
    }
    // Same column re-clicked → cycle asc → desc → cleared → asc. The
    // cleared state returns to the listCases default ordering (oldest first).
    if (sortDirRaw === 'asc') {
      setSortDir('desc');
    } else if (sortDirRaw === 'desc') {
      setSortCol(null);
      setSortDir(null);
    } else {
      setSortDir('asc');
    }
  };

  // -- Sort persistence (localStorage) -------------------------------------
  // On mount: if the URL is empty (e.g. user navigated to /cases via the
  // sidebar without query params) and there's a saved preference, restore
  // it. Guard with a ref so this runs once and the sync effect below
  // doesn't clobber storage on the first render before the restore lands.
  const hasMountedRef = useRef(false);
  useEffect(() => {
    if (sortCol) return; // URL already has sort — nothing to restore
    const saved = readSavedSort();
    if (!saved) return;
    setSortCol(saved.col);
    setSortDir(saved.dir);
    // setSortCol/setSortDir are stable nuqs setters; mount-only restore
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sync URL → storage on every change after mount. Skipping the very first
  // render avoids a race where this fires before the mount restore above and
  // would clear the saved value.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!hasMountedRef.current) {
      hasMountedRef.current = true;
      return;
    }
    if (sortCol) {
      window.localStorage.setItem(
        SORT_STORAGE_KEY,
        JSON.stringify({ col: sortCol, dir: sortDirRaw ?? 'asc' }),
      );
    } else {
      // Explicit cancel via the 3-cycle: forget the preference so the next
      // visit gets the default oldest-first view, not a re-surfaced old sort.
      window.localStorage.removeItem(SORT_STORAGE_KEY);
    }
  }, [sortCol, sortDirRaw]);

  if (filtered.length === 0) {
    return (
      <div className="px-6 py-12 text-center">
        <p className="text-sm text-neutral-600">{tf('noMatches')}</p>
        <div className="mt-4 flex justify-center">
          <ClearFiltersButton label={tf('clearFilters')} />
        </div>
      </div>
    );
  }

  return (
    <div>
      <table className="w-full table-fixed min-w-[1240px]">
        <caption className="sr-only">{tf('tableCaption', { count: filtered.length })}</caption>
        <colgroup>
          <col className="w-12" />
          <col className="w-52" />
          <col className="w-32" />
          <col className="w-48" />
          <col className="w-36" />
          <col className="w-44" />
          {canViewAll && <col className="w-44" />}
          <col />
        </colgroup>
        {/* Pins just below the sticky DashboardViewSelector (≈63px tall at xl,
            where this table renders) instead of flush at the viewport top, so
            the search bar and the column headers stay stacked, both visible.
            z-10 sits under the selector's z-20. */}
        <thead className="sticky top-[39px] z-10">
          <tr className="bg-neutral-100 border-b-2 border-neutral-300">
            <Th>{t('row')}</Th>
            <SortableTh
              label={t('clientName')}
              column="name"
              sort={sortForHeaders}
              onSort={handleSort}
            />
            <Th>{t('nationalId')}</Th>
            <SortableTh
              label={t('stage')}
              tooltip={t('stageTooltip')}
              column="stage"
              sort={sortForHeaders}
              onSort={handleSort}
            />
            <SortableTh
              label={t('targetDate')}
              column="targetDate"
              sort={sortForHeaders}
              onSort={handleSort}
            />
            <Th>{t('bank')}</Th>
            {canViewAll && <Th>{t('advisor')}</Th>}
            <Th>{t('shortNote')}</Th>
          </tr>
        </thead>
        <tbody className={densityClass}>
          {ordered.map((c, index) => (
            <CaseTableRow
              key={c.id}
              row={toRowData(c, index + 1, unreadSet)}
              statusOptions={statusOptions}
              bankOptions={bankOptions}
              advisorOptions={advisorOptions}
              canViewAll={canViewAll}
              editGate={editGate}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}

