'use client';

import { useMemo } from 'react';

import { useTranslations } from 'next-intl';
import { parseAsStringEnum, useQueryState } from 'nuqs';

import { toRowData } from '../domain/case-row-data';
import {
  applySort,
  SORT_COLUMNS,
  type CaseSort,
  type SortDir,
} from '../domain/case-sort';
import { useCaseQueryFilter } from '../hooks/use-case-query-filter';
import type { CaseWithRelations } from '../types';

import { CaseCard } from './case-card';
import { ClearFiltersButton } from './clear-filters-button';

type StatusOption = { id: string; name_he: string; color: string; sort_order: number };
type AdvisorOption = { id: string; first_name: string | null; last_name: string | null };

const SORT_DIRS: SortDir[] = ['asc', 'desc'];

type Props = {
  cases: ReadonlyArray<CaseWithRelations>;
  // Full status options: sort_order feeds the 'stage' sort, name_he/color feed
  // the inline status editor on each card (same array CasesTable receives).
  statusOptions: ReadonlyArray<StatusOption>;
  // Identity-only advisor list — feeds the inline advisor editor and resolves
  // names when the cases→profiles embed is RLS-gated to null (non-admins).
  advisorOptions: ReadonlyArray<AdvisorOption>;
  // Advisor row hidden for users who only see their own cases (see CasesTable).
  canViewAll: boolean;
};

/**
 * Mobile/narrow alternative to CasesTable. The 7-column table needs ~1100px,
 * so on small screens we render one card per case. Status, target date and
 * advisor are editable inline on each card (see CaseCard).
 */
export function CasesCardList({ cases, statusOptions, advisorOptions, canViewAll }: Props) {
  const t = useTranslations('dashboard');
  const filtered = useCaseQueryFilter(cases);

  // Mobile sort: read the same sort/dir URL params the desktop headers write
  // (shallow) and re-sort client-side so the cards reorder instantly.
  const [sortCol] = useQueryState(
    'sort',
    parseAsStringEnum([...SORT_COLUMNS]).withOptions({ shallow: true }),
  );
  const [sortDir] = useQueryState(
    'dir',
    parseAsStringEnum(SORT_DIRS).withOptions({ shallow: true }),
  );
  const ordered = useMemo(() => {
    const sort: CaseSort | null = sortCol ? { column: sortCol, dir: sortDir ?? 'asc' } : null;
    return applySort(filtered, sort, statusOptions);
  }, [filtered, sortCol, sortDir, statusOptions]);

  if (filtered.length === 0) {
    return (
      <div className="px-6 py-12 text-center">
        <p className="text-sm text-neutral-500">{t('filters.noMatches')}</p>
        <div className="mt-4 flex justify-center">
          <ClearFiltersButton label={t('filters.clearFilters')} />
        </div>
      </div>
    );
  }

  return (
    <ul className="divide-y divide-neutral-200">
      {ordered.map((c, index) => (
        <li key={c.id}>
          <CaseCard
            row={toRowData(c, index + 1)}
            statusOptions={statusOptions}
            advisorOptions={advisorOptions}
            canViewAll={canViewAll}
          />
        </li>
      ))}
    </ul>
  );
}
