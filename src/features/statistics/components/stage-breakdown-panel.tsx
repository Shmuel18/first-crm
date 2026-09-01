import { Timer } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';

import { parseLocale } from '@/lib/i18n/direction';

import { statusName, toStageBreakdownViews } from '../domain/metrics';
import { formatInt } from '../utils/format';

import type { StageBreakdownRow } from '../schemas/statistics.schema';

type Props = { rows: StageBreakdownRow[] };

const FALLBACK_COLOR = 'var(--color-brand-gold-dark)';

/**
 * Average time a case spends in each stage, slowest first — the "where does
 * the time actually go" half of Kaufman's cycle-time ask.
 *
 * Counts only COMPLETED stage visits (the RPC filters exited_at IS NOT NULL),
 * so a case sitting in a stage right now doesn't drag the average down before
 * it has finished. `n` is visits rather than cases: a file that bounces back
 * into איסוף מסמכים contributes both visits, which is what "time per visit"
 * has to mean. Server Component with CSS bars, same reasoning as the sibling
 * cycle-time panel.
 */
export function StageBreakdownPanel({ rows }: Props) {
  const t = useTranslations('statistics.stageBreakdown');
  const locale = parseLocale(useLocale());
  const views = toStageBreakdownViews(rows);

  return (
    <section className="rounded-xl border border-neutral-200 bg-white p-4">
      <div className="mb-1 flex items-center gap-2">
        <Timer className="size-4 shrink-0 text-brand-gold-text" aria-hidden="true" />
        <h2 className="font-display text-lg font-semibold text-neutral-950">{t('title')}</h2>
      </div>

      {views.length === 0 ? (
        <p className="py-6 text-center text-sm text-neutral-400">{t('empty')}</p>
      ) : (
        <>
          <p className="mb-4 text-xs text-neutral-400">{t('caption')}</p>
          <ul className="space-y-2.5">
            {views.map((row) => (
              <li
                key={row.key}
                className="grid grid-cols-[7.5rem_1fr_4.5rem] items-center gap-3 text-sm"
              >
                <span className="truncate text-neutral-600" title={statusName(row, locale)}>
                  {statusName(row, locale)}
                </span>
                <span className="h-2.5 overflow-hidden rounded-full bg-neutral-100">
                  <span
                    className="block h-full rounded-full"
                    style={{
                      width: `${row.barPct}%`,
                      backgroundColor: row.color ?? FALLBACK_COLOR,
                    }}
                  />
                </span>
                <span className="tabular-nums text-neutral-500">
                  <span className="font-medium text-neutral-900">
                    {formatInt(Math.round(row.avg_days))}
                  </span>{' '}
                  <span className="text-xs">{t('daysShort')}</span>
                </span>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
