'use client';

import { useEffect, useMemo, useRef } from 'react';

import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { parseAsStringEnum, useQueryState } from 'nuqs';

import {
  getCaseClientLabel,
  getPrimaryBank,
  getPrimaryBorrowerNationalId,
  getSecondaryBanksCount,
} from '../domain/case-derivations';
import {
  applySort,
  SORT_COLUMNS,
  type CaseSort,
  type SortColumn,
  type SortDir,
} from '../domain/case-sort';
import { isFrozenCase, isStuckCase } from '../domain/case-state';
import { useCaseQueryFilter } from '../hooks/use-case-query-filter';
import { useRowDensity } from '../hooks/use-row-density';
import type { CaseWithRelations } from '../types';

import { CaseTableRow, type CaseTableRowData } from './case-table-row';

type StatusOption = { id: string; name_he: string; color: string; sort_order: number };
type BankOption = { id: string; key: string; name_he: string; color: string; logo_url: string | null };
type AdvisorOption = { id: string; first_name: string | null; last_name: string | null };

type Props = {
  cases: ReadonlyArray<CaseWithRelations>;
  statusOptions: ReadonlyArray<StatusOption>;
  bankOptions: ReadonlyArray<BankOption>;
  advisorOptions: ReadonlyArray<AdvisorOption>;
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

export function CasesTable({ cases, statusOptions, bankOptions, advisorOptions }: Props) {
  const t = useTranslations('dashboard.columns');
  const tf = useTranslations('dashboard.filters');
  const filtered = useCaseQueryFilter(cases);
  const density = useRowDensity();

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
    return <p className="px-6 py-12 text-center text-sm text-neutral-600">{tf('noMatches')}</p>;
  }

  return (
    <div>
      <table className="w-full table-fixed min-w-[1100px]">
        <caption className="sr-only">{tf('tableCaption', { count: filtered.length })}</caption>
        <colgroup>
          <col className="w-12" />
          <col className="w-52" />
          <col className="w-32" />
          <col className="w-48" />
          <col className="w-44" />
          <col className="w-44" />
          <col />
        </colgroup>
        <thead className="sticky top-[-1rem] z-10 sm:top-[-1.5rem]">
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
              column="stage"
              sort={sortForHeaders}
              onSort={handleSort}
            />
            <Th>{t('bank')}</Th>
            <Th>{t('advisor')}</Th>
            <Th>{t('shortNote')}</Th>
          </tr>
        </thead>
        <tbody className={densityClass}>
          {ordered.map((c, index) => (
            <CaseTableRow
              key={c.id}
              row={toRowData(c, index + 1)}
              statusOptions={statusOptions}
              bankOptions={bankOptions}
              advisorOptions={advisorOptions}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function SortableTh({
  label,
  column,
  sort,
  onSort,
}: {
  label: string;
  column: SortColumn;
  sort: { column: SortColumn; dir: SortDir } | null;
  onSort: (column: SortColumn) => void;
}) {
  const isActive = sort?.column === column;
  const ariaSort = isActive ? (sort!.dir === 'asc' ? 'ascending' : 'descending') : 'none';
  const ArrowIcon = !isActive ? ArrowUpDown : sort!.dir === 'asc' ? ArrowUp : ArrowDown;

  return (
    <th scope="col" aria-sort={ariaSort} className="p-0">
      <button
        type="button"
        onClick={() => onSort(column)}
        className={[
          'group flex w-full items-center gap-1 px-4 py-3 text-start text-xs font-semibold uppercase tracking-wider transition-colors',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-gold-text/40',
          isActive
            ? 'text-neutral-900'
            : 'text-neutral-600 hover:text-neutral-900 hover:bg-neutral-50',
        ].join(' ')}
      >
        {label}
        <ArrowIcon
          aria-hidden="true"
          className={[
            'size-3 shrink-0 transition-opacity',
            isActive
              ? 'text-brand-gold-text opacity-100'
              : 'text-neutral-400 opacity-40 group-hover:opacity-100',
          ].join(' ')}
        />
      </button>
    </th>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th
      scope="col"
      className="text-start text-xs font-semibold text-neutral-600 uppercase tracking-wider px-4 py-3"
    >
      {children}
    </th>
  );
}

function toRowData(c: CaseWithRelations, index: number): CaseTableRowData {
  const advisorName =
    [c.assigned_advisor?.first_name, c.assigned_advisor?.last_name]
      .filter(Boolean)
      .join(' ') || null;
  const primaryBank = getPrimaryBank(c);

  return {
    id: c.id,
    index,
    clientLabel: getCaseClientLabel(c),
    nationalId: getPrimaryBorrowerNationalId(c),
    statusId: c.status_id,
    statusName: c.status?.name_he ?? null,
    statusColor: c.status?.color ?? null,
    primaryBank: primaryBank
      ? {
          id: primaryBank.id,
          key: primaryBank.key,
          name_he: primaryBank.name_he,
          color: primaryBank.color,
          logo_url: primaryBank.logo_url,
        }
      : null,
    secondaryBanksCount: getSecondaryBanksCount(c),
    advisorId: c.assigned_advisor_id,
    advisorName,
    shortNote: c.short_note ?? null,
    isStuck: isStuckCase(c),
    isFrozen: isFrozenCase(c),
    updatedAt: c.updated_at,
  };
}
