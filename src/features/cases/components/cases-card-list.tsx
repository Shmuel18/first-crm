'use client';

import Link from 'next/link';

import { useLocale, useTranslations } from 'next-intl';

import { parseLocale } from '@/lib/i18n/direction';
import { formatDateShort } from '@/lib/utils/format-date';
import { formatPersonName } from '@/lib/utils/person-name';

import { resolveAdvisorName } from '../domain/advisor-name';
import {
  getCaseClientLabel,
  getPrimaryBank,
  getPrimaryBorrowerNationalId,
} from '../domain/case-derivations';
import { isFrozenCase, isStuckCase } from '../domain/case-state';
import { getTargetDateState, type TargetDateState } from '../domain/target-date';
import { useCaseQueryFilter } from '../hooks/use-case-query-filter';
import type { CaseWithRelations } from '../types';

import { CaseStatusBadge } from './case-status-badge';
import { ClearFiltersButton } from './clear-filters-button';

type AdvisorOption = { id: string; first_name: string | null; last_name: string | null };

type Props = {
  cases: ReadonlyArray<CaseWithRelations>;
  // Identity-only advisor list — used to resolve the assigned advisor's name
  // from the id when the cases→profiles embed is RLS-gated to null (non-admins).
  advisorOptions: ReadonlyArray<AdvisorOption>;
  // Advisor row hidden for users who only see their own cases (see CasesTable).
  canViewAll: boolean;
};

/**
 * Mobile/narrow alternative to CasesTable. The 7-column table needs ~1100px,
 * so on small screens we render one card per case (read + tap to open) instead
 * of forcing a horizontal scroll. Inline editing stays on the desktop table.
 */
export function CasesCardList({ cases, advisorOptions, canViewAll }: Props) {
  const t = useTranslations('dashboard');
  const locale = parseLocale(useLocale());
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
        const targetDate = c.target_date ? formatDateShort(c.target_date, locale) : null;
        const advisorName =
          formatPersonName(c.assigned_advisor?.first_name, c.assigned_advisor?.last_name) ||
          resolveAdvisorName(c.assigned_advisor_id, advisorOptions);
        // Associated advisors (mig 146): compact "+N" next to the responsible
        // name (mobile has no hover, so we don't reveal names here).
        const associatedCount = (c.case_associated_advisors ?? []).filter((a) =>
          resolveAdvisorName(a.advisor_id, advisorOptions),
        ).length;
        const advisorDisplay =
          advisorName && associatedCount > 0
            ? `${advisorName} +${associatedCount}`
            : advisorName;

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
                <Field
                  label={t('columns.targetDate')}
                  value={targetDate}
                  tone={getTargetDateState(c.target_date)}
                />
                <Field label={t('columns.bank')} value={bank?.name_he ?? null} />
                {canViewAll && <Field label={t('columns.advisor')} value={advisorDisplay} />}
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

function Field({
  label,
  value,
  tone = 'none',
}: {
  label: string;
  value: string | null;
  tone?: TargetDateState;
}) {
  const valueClass =
    tone === 'overdue'
      ? 'text-red-700'
      : tone === 'soon'
        ? 'text-brand-gold-text'
        : 'text-neutral-700';
  return (
    <div className="flex gap-1.5">
      <dt className="text-neutral-400">{label}:</dt>
      <dd className={`truncate ${valueClass}`}>{value ?? '—'}</dd>
    </div>
  );
}
