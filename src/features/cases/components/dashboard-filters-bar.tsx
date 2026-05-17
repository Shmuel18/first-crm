import { ChevronDown, User } from 'lucide-react';

export function DashboardFiltersBar() {
  return (
    <div className="bg-white px-6 py-3 border-b border-neutral-200 flex items-center gap-2 flex-wrap">
      <FilterChip icon={User} label="התיקים שלי" />
      <FilterChip label="שלב בתהליך" />
      <FilterChip label="בנק" />
      <FilterChip label="גורם מעכב" />
      <div className="flex-1" />
      <ToggleSwitch label="רק תקועים" />
      <ToggleSwitch label="הסתר בוצעו והוקפאו" on />
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
            on ? 'right-0.5' : 'right-[18px]',
          ].join(' ')}
        />
      </span>
      <span className="text-neutral-700">{label}</span>
    </label>
  );
}
