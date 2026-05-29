'use client';

import { useTranslations } from 'next-intl';

import type { MixResult } from '../types';
import { formatMoney } from '../utils/format';

type Props = { result: MixResult };

export function AmortizationTable({ result }: Props) {
  const t = useTranslations('simulators.mix.table');
  const rows = result.paymentCurve.slice(0, 12).map((point) => ({
    month: point.monthIndex,
    payment: point.value,
    balance: result.balanceCurve[point.monthIndex - 1]?.value ?? 0,
  }));

  return (
    <section className="rounded-xl border border-neutral-200 bg-white p-4">
      <h2 className="mb-4 font-display text-lg font-semibold text-neutral-950">{t('title')}</h2>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[32rem] text-sm">
          <thead>
            <tr className="border-b border-neutral-200 text-neutral-500">
              <th className="px-3 py-2 text-start font-medium">{t('month')}</th>
              <th className="px-3 py-2 text-start font-medium">{t('payment')}</th>
              <th className="px-3 py-2 text-start font-medium">{t('balance')}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.month} className="border-b border-neutral-100 last:border-0">
                <td className="px-3 py-2">{row.month}</td>
                <td className="px-3 py-2 font-medium">{formatMoney(row.payment)}</td>
                <td className="px-3 py-2">{formatMoney(row.balance)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
