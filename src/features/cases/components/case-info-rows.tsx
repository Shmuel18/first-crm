import {
  CASE_BLOCKER_LABELS,
  INSURANCE_STATUS_LABELS,
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
  gold: 'text-[#C9A961]',
  red: 'text-red-600',
  green: 'text-emerald-600',
  yellow: 'text-amber-600',
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
  if (!blocker) return <DataRow label="גורם מעכב" value="לא צוין" />;
  const config = CASE_BLOCKER_LABELS[blocker];
  return (
    <div className="flex items-baseline justify-between gap-3 py-2 border-b border-neutral-100">
      <span className="text-sm text-neutral-600">גורם מעכב</span>
      <span
        className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium"
        style={{ backgroundColor: `${config.color}25`, color: config.color }}
      >
        <span className="size-1.5 rounded-full" style={{ backgroundColor: config.color }} />
        {config.he}
      </span>
    </div>
  );
}

export function InsuranceRow({ status }: { status: InsuranceStatus | null }) {
  if (!status) return <DataRow label="ביטוחים" value="לא צוין" />;
  const config = INSURANCE_STATUS_LABELS[status];
  return (
    <div className="flex items-baseline justify-between gap-3 py-2 border-b border-neutral-100">
      <span className="text-sm text-neutral-600">ביטוחים</span>
      <span
        className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium"
        style={{ backgroundColor: `${config.color}25`, color: config.color }}
      >
        {config.he}
      </span>
    </div>
  );
}
