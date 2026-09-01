import { getTranslations } from 'next-intl/server';

import type { Locale } from '@/lib/i18n/direction';
import { formatDateShort } from '@/lib/utils/format-date';

import { computeCaseCycleTime, resolveOpenedAt } from '../domain/cycle-time';

type Props = {
  /** Hand-entered real opening date (migration 243); null falls back below. */
  openedAt: string | null;
  /** cases.created_at — the row's insert time. */
  createdAt: string;
  /** First entry into ביצוע / בוצע ושולם, or null if not there yet. */
  reachedAt: string | null;
  /** Injected so the render is deterministic and testable. */
  now: string;
  locale: Locale;
};

/**
 * The timing readout at the top of the מנהלה block: when the file was opened,
 * when it reached ביצוע, and how long that took — Kaufman's ask, so the office
 * stops working it out by hand.
 *
 * Rendered as separate flex items rather than one interpolated sentence: in
 * RTL a middle-dot between a Hebrew label and a Latin-digit date drags the
 * separator to the wrong side of the run. Each pair is its own box, so the
 * browser lays them out right-to-left without any bidi isolates.
 */
export async function CaseCycleTimeLine({
  openedAt,
  createdAt,
  reachedAt,
  now,
  locale,
}: Props) {
  const t = await getTranslations('case.admin');
  const cycle = computeCaseCycleTime(openedAt, createdAt, reachedAt, now);

  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 pb-2 pt-2 text-xs text-neutral-500">
      <Pair
        label={t('openedAt')}
        value={formatDateShort(resolveOpenedAt(openedAt, createdAt), locale)}
      />
      {reachedAt !== null && (
        <Pair label={t('executionAt')} value={formatDateShort(reachedAt, locale)} />
      )}
      {cycle !== null && (
        <span className="font-medium text-brand-gold-text tabular-nums">
          {cycle.state === 'reached'
            ? t('daysToExecution', { days: cycle.days })
            : t('daysInProgress', { days: cycle.days })}
        </span>
      )}
    </div>
  );
}

function Pair({ label, value }: { label: string; value: string }) {
  return (
    <span>
      {label}:{' '}
      <span className="font-medium text-neutral-700 tabular-nums">{value}</span>
    </span>
  );
}
