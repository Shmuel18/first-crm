'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useTransition } from 'react';

import { useTranslations } from 'next-intl';

import { DateInputWithPicker } from '@/components/ui/date-input-with-picker';
import { STATISTICS_PRESETS } from '../types';

import type { StatisticsPeriod, StatisticsPreset } from '../types';

type Props = { active: StatisticsPeriod };

export function PeriodSelector({ active }: Props) {
  const t = useTranslations('statistics');
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  // The URL is the source of truth for the custom range — reading the raw
  // params (not the validated range) keeps a half-entered date visible while
  // the user is still picking the second one.
  const rawFrom = searchParams.get('from') ?? '';
  const rawTo = searchParams.get('to') ?? '';
  const isCustom = active === 'custom';
  const showInvalid = isCustom && rawFrom !== '' && rawTo !== '' && rawFrom > rawTo;

  function push(params: URLSearchParams): void {
    startTransition(() => router.push(`?${params.toString()}`, { scroll: false }));
  }

  function selectPreset(preset: StatisticsPreset): void {
    const params = new URLSearchParams(searchParams.toString());
    params.set('period', preset);
    params.delete('from');
    params.delete('to');
    push(params);
  }

  function setRange(next: { from?: string; to?: string }): void {
    const params = new URLSearchParams(searchParams.toString());
    params.set('period', 'custom');
    const from = next.from ?? rawFrom;
    const to = next.to ?? rawTo;
    if (from) params.set('from', from);
    else params.delete('from');
    if (to) params.set('to', to);
    else params.delete('to');
    push(params);
  }

  return (
    <div className={`flex flex-col items-start gap-2 ${isPending ? 'opacity-60' : ''}`}>
      <div
        role="group"
        aria-label={t('period.label')}
        className="inline-flex flex-wrap gap-1 rounded-lg border border-neutral-200 bg-white p-1"
      >
        {STATISTICS_PRESETS.map((preset) => (
          <PeriodButton
            key={preset}
            label={t(`period.${preset}`)}
            active={preset === active}
            onClick={() => selectPreset(preset)}
          />
        ))}
        <PeriodButton
          label={t('period.custom')}
          active={isCustom}
          onClick={() => setRange({})}
        />
      </div>

      {isCustom && (
        <div className="inline-flex flex-wrap items-center gap-x-3 gap-y-2 rounded-lg border border-neutral-200 bg-white p-2">
          <label className="flex items-center gap-1.5 text-sm text-neutral-600">
            <span className="shrink-0">{t('period.rangeFrom')}</span>
            <DateInputWithPicker
              value={rawFrom}
              onChange={(value) => setRange({ from: value })}
              pickerLabel={t('period.rangeFrom')}
              className="w-36"
            />
          </label>
          <label className="flex items-center gap-1.5 text-sm text-neutral-600">
            <span className="shrink-0">{t('period.rangeTo')}</span>
            <DateInputWithPicker
              value={rawTo}
              onChange={(value) => setRange({ to: value })}
              pickerLabel={t('period.rangeTo')}
              className="w-36"
            />
          </label>
          {showInvalid && (
            <p className="w-full text-xs text-red-600">{t('period.rangeInvalid')}</p>
          )}
        </div>
      )}
    </div>
  );
}

function PeriodButton({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={[
        'rounded-md px-3 py-1.5 text-sm transition-colors',
        active ? 'bg-brand-black text-white' : 'text-neutral-600 hover:bg-neutral-100',
      ].join(' ')}
    >
      {label}
    </button>
  );
}
