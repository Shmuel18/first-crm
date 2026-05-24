import { useTranslations } from 'next-intl';

import {
  CASE_BLOCKER_COLORS,
  INSURANCE_STATUS_COLORS,
  type CaseBlocker,
  type InsuranceStatus,
} from '../schemas/case.schema';

type Accent = 'gold' | 'red' | 'green' | 'yellow';

type DataRowProps = {
  label: string;
  value: string;
  large?: boolean;
  accent?: Accent;
};

const ACCENT_CLASSES: Record<Accent, string> = {
  gold: 'text-[#A88840]',
  red: 'text-red-700',
  green: 'text-emerald-700',
  yellow: 'text-amber-700',
};

export function DataRow({ label, value, large, accent }: DataRowProps) {
  const valueClass = [
    'tabular-nums font-semibold',
    large ? 'text-base' : 'text-sm',
    accent ? ACCENT_CLASSES[accent] : 'text-neutral-900',
  ].join(' ');

  return (
    <div className="flex items-baseline justify-between gap-3 py-2 border-b border-neutral-100 last:border-b-0">
      <span className="text-sm text-neutral-600">{label}</span>
      <span className={valueClass}>{value}</span>
    </div>
  );
}

export function BlockerRow({ blocker }: { blocker: CaseBlocker | null }) {
  const t = useTranslations('case');
  const tc = useTranslations('common');
  if (!blocker) return <DataRow label={t('fields.blocker')} value={tc('notSpecified')} />;
  const color = CASE_BLOCKER_COLORS[blocker];
  return (
    <div className="flex items-baseline justify-between gap-3 py-2 border-b border-neutral-100">
      <span className="text-sm text-neutral-600">{t('fields.blocker')}</span>
      <span
        className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium"
        style={{ backgroundColor: `${color}25`, color }}
      >
        <span className="size-1.5 rounded-full" style={{ backgroundColor: color }} />
        {t(`blocker.${blocker}`)}
      </span>
    </div>
  );
}

export function InsuranceRow({ status }: { status: InsuranceStatus | null }) {
  const t = useTranslations('case');
  const tc = useTranslations('common');
  if (!status) return <DataRow label={t('fields.insurance')} value={tc('notSpecified')} />;
  const color = INSURANCE_STATUS_COLORS[status];
  return (
    <div className="flex items-baseline justify-between gap-3 py-2 border-b border-neutral-100">
      <span className="text-sm text-neutral-600">{t('fields.insurance')}</span>
      <span
        className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium"
        style={{ backgroundColor: `${color}25`, color }}
      >
        {t(`insurance.${status}`)}
      </span>
    </div>
  );
}
