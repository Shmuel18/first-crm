import { ChevronDown, User } from 'lucide-react';
import { useTranslations } from 'next-intl';

export function DashboardFiltersBar() {
  const t = useTranslations('dashboard.filters');

  return (
    <div className="bg-white px-6 py-3 border-b border-neutral-200 flex items-center gap-2 flex-wrap">
      <FilterChip icon={User} label={t('myCases')} />
      <FilterChip label={t('stage')} />
      <FilterChip label={t('bank')} />
      <FilterChip label={t('blocker')} />
      <div className="flex-1" />
      <ToggleSwitch label={t('onlyStuck')} />
      <ToggleSwitch label={t('hideClosedFrozen')} on />
    </div>
  );
}

function FilterChip({
  icon: Icon,
  label,
}: {
  icon?: React.ComponentType<{ className?: string }>;
  label: string;
}) {
  return (
    <button
      type="button"
      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-neutral-200 text-sm text-neutral-700 hover:border-neutral-300 hover:bg-neutral-50 transition"
    >
      {Icon && <Icon className="size-3.5 text-neutral-400" />}
      <span>{label}</span>
      <ChevronDown className="size-3.5 text-neutral-400" />
    </button>
  );
}

function ToggleSwitch({ label, on }: { label: string; on?: boolean }) {
  return (
    <label className="inline-flex items-center gap-2 text-sm cursor-pointer">
      <span
        className={[
          'relative w-9 h-5 rounded-full transition',
          on ? 'bg-[#C9A961]' : 'bg-neutral-300',
        ].join(' ')}
      >
        <span
          className={[
            'absolute top-0.5 size-4 rounded-full bg-white transition',
            on ? 'end-0.5' : 'end-[18px]',
          ].join(' ')}
        />
      </span>
      <span className="text-neutral-700">{label}</span>
    </label>
  );
}
