import { Hourglass } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { toCycleBucketViews } from '../domain/metrics';
import { formatInt } from '../utils/format';

import type { CycleTime } from '../schemas/statistics.schema';

type Props = { cycleTime: CycleTime | null };

/**
 * "כמה זמן אורך תיק" — the distribution behind the average cycle-time KPI.
 *
 * Deliberately NOT period-scoped: the KPI beside it already answers "this
 * month", and at ~80 cases a month holds a handful of deals, so a windowed
 * histogram would be noise. This one describes every case that ever reached
 * ביצוע, and the caption says so.
 *
 * Plain CSS bars rather than Recharts — it keeps the panel a Server Component
 * and sidesteps the library's missing RTL support (the other two charts have
 * to force dir="ltr" around themselves to stay readable).
 */
export function CycleTimePanel({ cycleTime }: Props) {
  const t = useTranslations('statistics.cycleTime');
  const buckets = cycleTime ? toCycleBucketViews(cycleTime.buckets, cycleTime.n) : [];
  const hasAny = cycleTime !== null && cycleTime.n > 0;

  return (
    <section className="rounded-xl border border-neutral-200 bg-white p-4">
      <div className="mb-1 flex items-center gap-2">
        <Hourglass className="size-4 shrink-0 text-brand-gold-text" aria-hidden="true" />
        <h2 className="font-display text-lg font-semibold text-neutral-950">{t('title')}</h2>
      </div>

      {!hasAny ? (
        <p className="py-6 text-center text-sm text-neutral-400">{t('empty')}</p>
      ) : (
        <>
          <p className="mb-4 text-xs text-neutral-400">
            {t('caption', { count: cycleTime.n })}
            {cycleTime.avg_days !== null && (
              <>
                {' — '}
                <span className="font-medium tabular-nums text-neutral-600">
                  {t('average', { days: Math.round(cycleTime.avg_days) })}
                </span>
              </>
            )}
          </p>
          <ul className="space-y-2.5">
            {buckets.map((bucket) => (
              <li
                key={bucket.key}
                className="grid grid-cols-[6.5rem_1fr_4.5rem] items-center gap-3 text-sm"
              >
                <span className="truncate text-neutral-600">{t(`buckets.${bucket.key}`)}</span>
                <span className="h-2.5 overflow-hidden rounded-full bg-neutral-100">
                  <span
                    className="block h-full rounded-full bg-brand-gold"
                    style={{ width: `${bucket.barPct}%` }}
                  />
                </span>
                <span className="tabular-nums text-neutral-500">
                  <span className="font-medium text-neutral-900">{formatInt(bucket.count)}</span>{' '}
                  <span className="text-xs">({bucket.share}%)</span>
                </span>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
