'use client';

import { AlertTriangle } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { formatMoney, formatPct } from '../utils/format';
import type { RegulatoryViolation } from '../types';

type Props = { violations: ReadonlyArray<RegulatoryViolation> };

export function RegulatoryViolationsBanner({ violations }: Props) {
  const t = useTranslations('simulators.violations');
  if (violations.length === 0) return null;

  return (
    <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-red-900">
      <div className="flex items-start gap-3">
        <AlertTriangle className="mt-0.5 size-5 shrink-0 text-red-600" aria-hidden="true" />
        <div>
          <p className="text-sm font-semibold">{t('title')}</p>
          <ul className="mt-2 space-y-1 text-sm">
            {violations.map((violation) => (
              <li key={violation.code}>
                {t(violation.code, {
                  actual: formatViolationValue(violation.code, violation.actual),
                  limit: formatViolationValue(violation.code, violation.limit),
                })}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

function formatViolationValue(code: RegulatoryViolation['code'], value: number): string {
  if (code === 'term_too_long') return String(value);
  return code === 'amount_mismatch' ? formatMoney(value) : formatPct(value);
}
