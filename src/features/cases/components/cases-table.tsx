'use client';

import { Fragment, useMemo } from 'react';

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
  DEFAULT_SORT,
  SORT_COLUMNS,
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

export function CasesTable({ cases, statusOptions, bankOptions, advisorOptions }: Props) {
  const t = useTranslations('dashboard.columns');
  const tf = useTranslations('dashboard.filters');
  const filtered = useCaseQueryFilter(cases);
  const density = useRowDensity();

  // shallow:true — sort runs entirely client-side; no server round-trip on
  // every header click.
  const [sortCol, setSortCol] = useQueryState(
    'sort',
    parseAsStringEnum(SORT_COLUMNS as unknown as SortColumn[])
      .withDefault(DEFAULT_SORT.column)
      .withOptions({ shallow: true }),
  );
  const [sortDir, setSortDir] = useQueryState(
    'dir',
    parseAsStringEnum(SORT_DIRS).withDefault(DEFAULT_SORT.dir).withOptions({ shallow: true }),
  );
  const sort = { column: sortCol, dir: sortDir };

  const ordered = useMemo(
    () => applySort(filtered, sort, statusOptions),
    // sort is recreated each render but its parts are stable in deps
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [filtered, sortCol, sortDir, statusOptions],
  );

  // Chronological rank within the filtered set: newest case = #1, oldest = #N.
  // The number is a property of the case (not the row position), so when the
  // user flips the sort direction the same case keeps the same number — it
  // just moves up or down the page. That's how you can tell at a glance
  // which way the sort is pointed.
  const chronoRank = useMemo(() => {
    const byCreated = [...filtered].sort((a, b) => {
      const ac = a.created_at ?? '';
      const bc = b.created_at ?? '';
      if (ac === bc) return 0;
      return ac > bc ? -1 : 1; // DESC
    });
    const map = new Map<string, number>();
    byCreated.forEach((c, idx) => map.set(c.id, idx + 1));
    return map;
  }, [filtered]);

  const densityClass =
    density === 'compact'
      ? '[&_td]:h-10 [&_td]:py-1.5'
      : density === 'comfortable'
        ? '[&_td]:h-16 [&_td]:py-4'
        : '[&_td]:h-14';

  // Header click — same column flips direction, different column starts ASC.
  // Special case: clicking the active column twice brings the user back to
  // the default sort (#↓ = newest first) rather than spinning forever.
  const handleSort = (column: SortColumn) => {
    if (column !== sortCol) {
      setSortCol(column);
      setSortDir('asc');
      return;
    }
    if (sortDir === 'asc') {
      setSortDir('desc');
      return;
    }
    // active + already desc → reset to default
    setSortCol(DEFAULT_SORT.column);
    setSortDir(DEFAULT_SORT.dir);
  };

  if (filtered.length === 0) {
    return <p className="px-6 py-12 text-center text-sm text-neutral-600">{tf('noMatches')}</p>;
  }

  return (
    <div>
      <table className="w-full table-fixed min-w-[1100px]">
        <caption className="sr-only">{tf('tableCaption', { count: filtered.length })}</caption>
        <colgroup>
          {/* # column needs room for the sort arrow next to the digit. */}
          <col className="w-16" />
          <col className="w-52" />
          <col className="w-32" />
          <col className="w-48" />
          <col className="w-44" />
          <col className="w-44" />
          <col />
        </colgroup>
        <thead className="sticky top-[-1rem] z-10 sm:top-[-1.5rem]">
          <tr className="bg-neutral-100 border-b-2 border-neutral-300">
            <SortableTh label={t('row')} column="created" sort={sort} onSort={handleSort} />
            <SortableTh label={t('clientName')} column="name" sort={sort} onSort={handleSort} />
            <Th>{t('nationalId')}</Th>
            <SortableTh label={t('stage')} column="stage" sort={sort} onSort={handleSort} />
            <Th>{t('bank')}</Th>
            <Th>{t('advisor')}</Th>
            <Th>{t('shortNote')}</Th>
          </tr>
        </thead>
        <tbody className={densityClass}>
          {ordered.map((c) => (
            <Fragment key={c.id}>
              <CaseTableRow
                row={toRowData(c, chronoRank.get(c.id) ?? 0)}
                statusOptions={statusOptions}
                bankOptions={bankOptions}
                advisorOptions={advisorOptions}
              />
            </Fragment>
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
  sort: { column: SortColumn; dir: SortDir };
  onSort: (column: SortColumn) => void;
}) {
  const isActive = sort.column === column;
  const ariaSort = isActive ? (sort.dir === 'asc' ? 'ascending' : 'descending') : 'none';
  const ArrowIcon = !isActive ? ArrowUpDown : sort.dir === 'asc' ? ArrowUp : ArrowDown;

  // Padding lives on the BUTTON, not the <th>, so the entire cell area is
  // clickable — without this trick the cell padding sits over an unclickable
  // <th> and a tap near the digit (instead of dead-centre on it) does nothing.
  return (
    <th scope="col" aria-sort={ariaSort} className="p-0">
      <button
        type="button"
        onClick={() => onSort(column)}
        className={[
          'group flex w-full items-center gap-1 px-4 py-3 text-start text-xs font-semibold uppercase tracking-wider transition-colors',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#A88840]/40',
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
              ? 'text-[#A88840] opacity-100'
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
