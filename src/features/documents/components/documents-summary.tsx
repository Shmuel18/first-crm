import { AlertTriangle, CheckCircle2, Clock, FolderArchive } from 'lucide-react';
import { useTranslations } from 'next-intl';

type Props = {
  total: number;
  verified: number;
  pending: number;
  missing?: number;
  requiredTotal?: number;
  collected?: number;
};

export function DocumentsSummary({
  total,
  verified,
  pending,
  missing = 0,
  requiredTotal = 0,
  collected = 0,
}: Props) {
  const t = useTranslations('documents.summary');
  const denominator = requiredTotal > 0 ? requiredTotal : Math.max(total, missing, 0);
  const numerator = denominator > 0 ? Math.min(collected || total, denominator) : 0;
  const progress = denominator > 0 ? Math.round((numerator / denominator) * 100) : 0;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <FolderArchive className="size-4 text-brand-gold-text" aria-hidden="true" />
            <h2 className="font-display text-base font-semibold text-neutral-950">
              {t('progressTitle')}
            </h2>
          </div>
          <p className="mt-1 text-sm text-neutral-600">
            {denominator > 0
              ? t('progressValue', { collected: numerator, total: denominator })
              : t('progressEmpty')}
          </p>
        </div>

        <div className="text-end">
          <div className="text-2xl font-semibold tabular-nums text-neutral-950">
            {progress}%
          </div>
          <div className="text-xs text-neutral-500">{t('progressLabel')}</div>
        </div>
      </div>

      <div
        className="h-3 overflow-hidden rounded-full bg-neutral-100 ring-1 ring-inset ring-neutral-200"
        aria-label={t('progressAria', { percent: progress })}
        role="progressbar"
        aria-valuenow={progress}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div
          className="h-full rounded-full bg-gradient-to-l from-brand-gold via-amber-400 to-emerald-500 transition-[width] duration-500 ease-out"
          style={{ width: `${progress}%` }}
        />
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
        <Stat
          icon={<FolderArchive className="size-4 text-neutral-500" />}
          tone="neutral"
          value={String(total)}
          text={t('total', { count: total })}
        />
        <Stat
          icon={<CheckCircle2 className="size-4 text-emerald-600" />}
          tone="emerald"
          value={String(verified)}
          text={t('verified', { count: verified })}
        />
        <Stat
          icon={<Clock className="size-4 text-amber-600" />}
          tone="amber"
          value={String(pending)}
          text={t('pending', { count: pending })}
        />
        <Stat
          icon={<AlertTriangle className="size-4 text-rose-600" />}
          tone="rose"
          value={String(missing)}
          text={t('missing', { count: missing })}
        />
      </div>
    </div>
  );
}

function Stat({
  icon,
  text,
  value,
  tone,
}: {
  icon: React.ReactNode;
  text: string;
  value: string;
  tone: 'neutral' | 'emerald' | 'amber' | 'rose';
}) {
  const toneClass = {
    neutral: 'border-neutral-200 bg-white',
    emerald: 'border-emerald-100 bg-emerald-50/60',
    amber: 'border-amber-100 bg-amber-50/60',
    rose: 'border-rose-100 bg-rose-50/60',
  }[tone];

  return (
    <div className={`rounded-lg border px-3 py-2.5 ${toneClass}`}>
      <div className="flex items-center justify-between gap-3">
        <span className="text-xl font-semibold tabular-nums text-neutral-950">{value}</span>
        {icon}
      </div>
      <div className="mt-1 text-xs text-neutral-600 truncate">{text}</div>
    </div>
  );
}
