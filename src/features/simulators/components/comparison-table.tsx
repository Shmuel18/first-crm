'use client';

import { useTranslations } from 'next-intl';

import type { MixComparisonResult, MixComparisonRow } from '../domain/mix-compare';
import { formatMoney, formatPct } from '../utils/format';

type Props = { comparison: MixComparisonResult };

type Metric = {
  key: string;
  value: (row: MixComparisonRow) => number;
  format: (value: number) => string;
};

const METRICS: ReadonlyArray<Metric> = [
  { key: 'firstPayment', value: (r) => r.result.firstPayment, format: formatMoney },
  { key: 'maxPayment', value: (r) => r.result.maxPayment, format: formatMoney },
  { key: 'totalCost', value: (r) => r.result.totalCost, format: formatMoney },
  { key: 'totalInterest', value: (r) => r.result.totalInterest, format: formatMoney },
  { key: 'totalIndexation', value: (r) => r.result.totalIndexation, format: formatMoney },
  { key: 'paymentRisk', value: (r) => r.paymentIncreaseRiskPct, format: (v) => formatPct(v) },
  { key: 'balanceY5', value: (r) => r.result.balanceAt.y5, format: formatMoney },
  { key: 'balanceY10', value: (r) => r.result.balanceAt.y10, format: formatMoney },
  { key: 'balanceY15', value: (r) => r.result.balanceAt.y15, format: formatMoney },
];

export function ComparisonTable({ comparison }: Props) {
  const t = useTranslations('simulators.compare.table');
  const tv = useTranslations('simulators.compare');
  const { rows } = comparison;

  return (
    <section className="rounded-xl border border-neutral-200 bg-white p-4">
      <h2 className="mb-4 font-display text-lg font-semibold text-neutral-950">{t('title')}</h2>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[36rem] text-sm">
          <thead>
            <tr className="border-b border-neutral-200 text-neutral-500">
              <th className="sticky start-0 z-10 bg-white px-3 py-2 text-start font-medium">{t('metric')}</th>
              {rows.map((row) => (
                <th key={row.label} className="px-3 py-2 text-start font-semibold text-neutral-800">
                  {tv('variant', { label: row.label })}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {METRICS.map((metric) => {
              const best = bestValue(rows, metric.value);
              return (
                <tr key={metric.key} className="border-b border-neutral-100 last:border-0">
                  <td className="sticky start-0 bg-white px-3 py-2 text-neutral-600">{t(metric.key)}</td>
                  {rows.map((row) => {
                    const value = metric.value(row);
                    const isBest = rows.length > 1 && value === best;
                    return (
                      <td
                        key={row.label}
                        className={`px-3 py-2 font-medium ${isBest ? 'rounded-md bg-emerald-50 text-emerald-700' : 'text-neutral-900'}`}
                      >
                        {metric.format(value)}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-xs text-neutral-400">{t('bestNote')}</p>
    </section>
  );
}

function bestValue(rows: ReadonlyArray<MixComparisonRow>, value: (row: MixComparisonRow) => number): number {
  return rows.reduce((best, row) => Math.min(best, value(row)), Number.POSITIVE_INFINITY);
}
