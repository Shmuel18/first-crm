import { useTranslations } from 'next-intl';

type Props = {
  open: number;
  overdue: number;
  done: number;
};

export function TasksStatStrip({ open, overdue, done }: Props) {
  const t = useTranslations('tasks.stats');
  return (
    <div className="grid grid-cols-3 gap-3">
      <StatCard label={t('open')} value={open} tone="text-neutral-900" />
      <StatCard
        label={t('overdue')}
        value={overdue}
        tone={overdue > 0 ? 'text-status-error-text' : 'text-neutral-900'}
      />
      <StatCard label={t('done')} value={done} tone="text-status-success-text" />
    </div>
  );
}

function StatCard({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <div className="relative overflow-hidden bg-white border border-neutral-200 rounded-xl px-4 py-3.5 shadow-sm">
      <p className="text-xs font-medium text-neutral-500">{label}</p>
      <p className={`font-display text-2xl font-bold tabular-nums leading-tight tracking-tight mt-1 ${tone}`}>
        {value}
      </p>
      <span
        aria-hidden
        className="pointer-events-none absolute -end-2.5 -bottom-2.5 size-14 rounded-full opacity-50"
        style={{ background: 'radial-gradient(circle at 30% 30%, #E8D5A2, transparent 70%)' }}
      />
    </div>
  );
}
