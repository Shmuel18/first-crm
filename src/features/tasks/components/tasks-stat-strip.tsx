'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';

import { useTranslations } from 'next-intl';

type Focus = 'immediate' | 'overdue';

type Props = {
  immediate: number;
  open: number;
  overdue: number;
  done: number;
  /** Active triage focus from the URL (?focus=immediate|overdue). */
  focus: Focus | null;
};

export function TasksStatStrip({ immediate, open, overdue, done, focus }: Props) {
  const t = useTranslations('tasks.stats');
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Toggle ?focus= while preserving the other filters (view / tag / display /
  // case). Clicking the already-active card clears the focus.
  const toggleFocus = (next: Focus) => {
    const params = new URLSearchParams(searchParams.toString());
    if (focus === next) params.delete('focus');
    else params.set('focus', next);
    const qs = params.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname);
  };

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      {/* Immediate + Overdue are cross-status triage filters → clickable (only
          when there's something to focus). Open/Done map to board columns, so
          they stay passive stats. */}
      <StatCard
        label={t('immediate')}
        value={immediate}
        tone={immediate > 0 ? 'text-status-error-text' : 'text-neutral-900'}
        urgent={immediate > 0}
        active={focus === 'immediate'}
        onClick={immediate > 0 ? () => toggleFocus('immediate') : undefined}
      />
      <StatCard label={t('open')} value={open} tone="text-neutral-900" />
      <StatCard
        label={t('overdue')}
        value={overdue}
        tone={overdue > 0 ? 'text-status-error-text' : 'text-neutral-900'}
        active={focus === 'overdue'}
        onClick={overdue > 0 ? () => toggleFocus('overdue') : undefined}
      />
      <StatCard label={t('done')} value={done} tone="text-status-success-text" />
    </div>
  );
}

function StatCard({
  label,
  value,
  tone,
  urgent = false,
  active = false,
  onClick,
}: {
  label: string;
  value: number;
  tone: string;
  urgent?: boolean;
  active?: boolean;
  onClick?: () => void;
}) {
  const className = [
    'relative w-full overflow-hidden rounded-xl border bg-white px-4 py-3.5 text-start shadow-sm transition-colors',
    urgent ? 'task-critical-surface border-red-200 bg-red-50/60' : 'border-neutral-200',
    onClick
      ? 'cursor-pointer hover:border-brand-gold-text/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold-text/40'
      : '',
    active ? 'ring-2 ring-brand-gold-text/70' : '',
  ].join(' ');

  const body = (
    <>
      <p className="text-xs font-medium text-neutral-500">{label}</p>
      <p
        className={`font-display mt-1 text-2xl font-bold leading-tight tracking-tight tabular-nums ${tone}`}
      >
        {value}
      </p>
      {/* Subtle gold glow — softened (opacity-20) so it reads as a quiet brand
          accent, not an unfinished blob. */}
      <span
        aria-hidden
        className="pointer-events-none absolute -end-2.5 -bottom-2.5 size-12 rounded-full opacity-20"
        style={{ background: 'radial-gradient(circle at 30% 30%, #E8D5A2, transparent 70%)' }}
      />
    </>
  );

  if (!onClick) {
    return <div className={className}>{body}</div>;
  }
  return (
    <button type="button" onClick={onClick} aria-pressed={active} className={className}>
      {body}
    </button>
  );
}
