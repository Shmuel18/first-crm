'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useTransition } from 'react';

import { useTranslations } from 'next-intl';

import { STATISTICS_PERIODS } from '../types';

import type { StatisticsPeriod } from '../types';

type Props = { active: StatisticsPeriod };

export function PeriodSelector({ active }: Props) {
  const t = useTranslations('statistics');
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  function select(period: StatisticsPeriod) {
    const params = new URLSearchParams(searchParams.toString());
    params.set('period', period);
    startTransition(() => router.push(`?${params.toString()}`, { scroll: false }));
  }

  return (
    <div
      role="group"
      aria-label={t('period.label')}
      className={`inline-flex flex-wrap gap-1 rounded-lg border border-neutral-200 bg-white p-1 ${
        isPending ? 'opacity-60' : ''
      }`}
    >
      {STATISTICS_PERIODS.map((period) => {
        const isActive = period === active;
        return (
          <button
            key={period}
            type="button"
            onClick={() => select(period)}
            aria-pressed={isActive}
            className={[
              'rounded-md px-3 py-1.5 text-sm transition-colors',
              isActive ? 'bg-brand-black text-white' : 'text-neutral-600 hover:bg-neutral-100',
            ].join(' ')}
          >
            {t(`period.${period}`)}
          </button>
        );
      })}
    </div>
  );
}
