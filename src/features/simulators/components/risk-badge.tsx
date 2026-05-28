'use client';

import { ShieldAlert, ShieldCheck, ShieldQuestion } from 'lucide-react';
import { useTranslations } from 'next-intl';

import type { RiskLevel } from '../types';

type Props = { risk: RiskLevel };

const STYLES: Record<RiskLevel, { className: string; Icon: typeof ShieldCheck }> = {
  low: { className: 'border-emerald-200 bg-emerald-50 text-emerald-700', Icon: ShieldCheck },
  medium: { className: 'border-amber-200 bg-amber-50 text-amber-700', Icon: ShieldQuestion },
  high: { className: 'border-red-200 bg-red-50 text-red-700', Icon: ShieldAlert },
};

export function RiskBadge({ risk }: Props) {
  const t = useTranslations('simulators.scenario.risk');
  const { className, Icon } = STYLES[risk];

  return (
    <span className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-sm font-semibold ${className}`}>
      <Icon className="size-4" aria-hidden="true" />
      {t('label')}: {t(risk)}
    </span>
  );
}
