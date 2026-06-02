import { useTranslations } from 'next-intl';

import { formatInt } from '../utils/format';

import type { AdvisorStat } from '../schemas/statistics.schema';

type Props = { rows: AdvisorStat[] };

function advisorName(row: AdvisorStat): string {
  const name = [row.first_name, row.last_name].filter(Boolean).join(' ').trim();
  return name.length > 0 ? name : '—';
}

export function AdvisorBreakdown({ rows }: Props) {
  const t = useTranslations('statistics');

  return (
    <section className="rounded-xl border border-neutral-200 bg-white p-4">
      <h2 className="mb-3 font-display text-lg font-semibold text-neutral-950">
        {t('advisor.title')}
      </h2>
      {rows.length === 0 ? (
        <p className="py-6 text-center text-sm text-neutral-400">{t('advisor.empty')}</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-neutral-200 text-start text-xs text-neutral-500">
                <th className="py-2 pe-3 text-start font-medium">{t('advisor.name')}</th>
                <th className="py-2 px-3 text-center font-medium">{t('advisor.activeCases')}</th>
                <th className="py-2 ps-3 text-center font-medium">{t('advisor.executed')}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.advisor_id} className="border-b border-neutral-100 last:border-0">
                  <td className="py-2 pe-3 text-start text-neutral-900">{advisorName(row)}</td>
                  <td className="py-2 px-3 text-center tabular-nums text-neutral-700">
                    {formatInt(row.active_cases)}
                  </td>
                  <td className="py-2 ps-3 text-center tabular-nums font-medium text-brand-gold-text">
                    {formatInt(row.executed_in_period)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
