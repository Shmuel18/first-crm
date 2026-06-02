'use client';

import {
  Bar,
  BarChart,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { useLocale, useTranslations } from 'next-intl';

import { parseLocale } from '@/lib/i18n/direction';
import { splitPipeline, statusName } from '../domain/metrics';
import { formatInt } from '../utils/format';

import type { StatusSnapshot } from '../schemas/statistics.schema';

type Props = { snapshot: StatusSnapshot[] };

const FALLBACK_COLOR = 'var(--color-brand-gold-dark)';

export function PipelineFunnel({ snapshot }: Props) {
  const t = useTranslations('statistics');
  const locale = parseLocale(useLocale());
  const { pipeline, side } = splitPipeline(snapshot);
  const data = pipeline.map((status) => ({
    key: status.key,
    name: statusName(status, locale),
    count: status.count,
    color: status.color ?? FALLBACK_COLOR,
  }));
  const hasAny = pipeline.some((s) => s.count > 0) || side.some((s) => s.count > 0);

  return (
    <section className="rounded-xl border border-neutral-200 bg-white p-4">
      <h2 className="mb-4 font-display text-lg font-semibold text-neutral-950">
        {t('pipeline.title')}
      </h2>
      {!hasAny ? (
        <p className="py-6 text-center text-sm text-neutral-400">{t('pipeline.empty')}</p>
      ) : (
        <>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%" minHeight={280}>
              <BarChart layout="vertical" data={data} margin={{ top: 4, right: 16, bottom: 4, left: 8 }}>
                <XAxis type="number" tickLine={false} axisLine={false} tick={{ fontSize: 12 }} allowDecimals={false} />
                <YAxis
                  type="category"
                  dataKey="name"
                  tickLine={false}
                  axisLine={false}
                  width={120}
                  tick={{ fontSize: 11 }}
                />
                <Tooltip
                  formatter={(value) => formatInt(Number(value))}
                  cursor={{ fill: 'var(--color-brand-gold-soft)' }}
                />
                <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                  {data.map((entry) => (
                    <Cell key={entry.key} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          {side.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2 border-t border-neutral-100 pt-3">
              {side.map((status) => (
                <span
                  key={status.key}
                  className="inline-flex items-center gap-1.5 rounded-full border border-neutral-200 px-2.5 py-1 text-xs text-neutral-600"
                >
                  <span
                    className="size-2 rounded-full"
                    style={{ backgroundColor: status.color ?? FALLBACK_COLOR }}
                    aria-hidden="true"
                  />
                  {statusName(status, locale)}
                  <span className="font-medium tabular-nums text-neutral-900">{formatInt(status.count)}</span>
                </span>
              ))}
            </div>
          )}
        </>
      )}
    </section>
  );
}
