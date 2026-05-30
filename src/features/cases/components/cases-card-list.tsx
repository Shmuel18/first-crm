'use client';

import Link from 'next/link';

import { useTranslations } from 'next-intl';

import { formatPersonName } from '@/lib/utils/person-name';

import {
  getCaseClientLabel,
  getPrimaryBank,
  getPrimaryBorrowerNationalId,
} from '../domain/case-derivations';
import { isFrozenCase, isStuckCase } from '../domain/case-state';
import { useCaseQueryFilter } from '../hooks/use-case-query-filter';
import type { CaseWithRelations } from '../types';

import { CaseStatusBadge } from './case-status-badge';
import { ClearFiltersButton } from './clear-filters-button';

type Props = {
  cases: ReadonlyArray<CaseWithRelations>;
};

/**
 * Mobile/narrow alternative to CasesTable. The 7-column table needs ~1100px,
 * so on small screens we render one card per case (read + tap to open) instead
 * of forcing a horizontal scroll. Inline editing stays on the desktop table.
 */
export function CasesCardList({ cases }: Props) {
  const t = useTranslations('dashboard');
  const filtered = useCaseQueryFilter(cases);

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
      {filtered.map((c, index) => {
        const stuck = isStuckCase(c);
        const frozen = isFrozenCase(c);
        const client = getCaseClientLabel(c);
        const bank = getPrimaryBank(c);
        const advisorName =
          formatPersonName(c.assigned_advisor?.first_name, c.assigned_advisor?.last_name) ||
          null;

        const cardClass = [
          'block px-4 py-3 transition-colors',
          stuck
            ? 'bg-red-50 active:bg-red-100'
            : frozen
              ? 'bg-neutral-100 text-neutral-500 active:bg-neutral-200'
              : 'bg-white active:bg-brand-row-hover',
        ].join(' ');

        return (
          <li key={c.id}>
            <Link href={`/cases/${c.id}`} className={cardClass}>
              <div className="flex items-start justify-between gap-2">
                <div className="flex min-w-0 items-center gap-2">
                  <span className="text-xs text-neutral-400 tabular-nums">{index + 1}</span>
                  <span className="truncate text-sm font-medium text-neutral-900">
                    {client || (
                      <span className="font-normal italic text-neutral-400">
                        {t('rowState.noBorrowers')}
                      </span>
                    )}
                  </span>
                </div>
                <CaseStatusBadge name={c.status?.name_he} color={c.status?.color} />
              </div>

              <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                <Field label={t('columns.nationalId')} value={getPrimaryBorrowerNationalId(c)} />
                <Field label={t('columns.bank')} value={bank?.name_he ?? null} />
                <Field label={t('columns.advisor')} value={advisorName} />
              </dl>

              {c.short_note && (
                <p className="mt-2 line-clamp-2 text-xs text-neutral-500">{c.short_note}</p>
              )}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

function Field({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="flex gap-1.5">
      <dt className="text-neutral-400">{label}:</dt>
      <dd className="truncate text-neutral-700">{value ?? '—'}</dd>
    </div>
  );
}
