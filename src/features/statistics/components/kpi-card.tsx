import { ArrowDownRight, ArrowUpRight, Minus } from 'lucide-react';

import type { Delta, StatusDirection } from '../domain/metrics';

type Props = {
  label: string;
  value: string;
  hint?: string;
  delta?: Delta;
  /** Short comparison caption (e.g. "vs last month") shown beside the delta. */
  deltaLabel?: string;
  icon?: React.ComponentType<{ className?: string }>;
};

const DELTA_STYLE: Record<StatusDirection, { cls: string; Icon: React.ComponentType<{ className?: string }> }> = {
  up: { cls: 'text-emerald-600', Icon: ArrowUpRight },
  down: { cls: 'text-red-600', Icon: ArrowDownRight },
  flat: { cls: 'text-neutral-400', Icon: Minus },
};

function DeltaBadge({ delta, label }: { delta: Delta; label?: string }) {
  const { cls, Icon } = DELTA_STYLE[delta.direction];
  return (
    <span className={`inline-flex items-center gap-0.5 text-xs font-medium ${cls}`}>
      <Icon className="size-3.5" aria-hidden="true" />
      {delta.pct !== null && <span className="tabular-nums">{Math.abs(delta.pct)}%</span>}
      {label && <span className="text-neutral-400 font-normal">{label}</span>}
    </span>
  );
}

export function KpiCard({ label, value, hint, delta, deltaLabel, icon: Icon }: Props) {
  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-4">
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm text-neutral-500">{label}</span>
        {Icon ? <Icon className="size-4 shrink-0 text-brand-gold-text" /> : null}
      </div>
      <div className="mt-2 flex flex-wrap items-baseline gap-x-2 gap-y-1">
        <span className="font-display text-2xl font-semibold tabular-nums text-neutral-950">{value}</span>
        {delta ? <DeltaBadge delta={delta} label={deltaLabel} /> : null}
      </div>
      {hint ? <p className="mt-1 text-xs text-neutral-400">{hint}</p> : null}
    </div>
  );
}
