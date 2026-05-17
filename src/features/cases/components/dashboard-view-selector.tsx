import { Archive, FolderOpen, Sprout } from 'lucide-react';

type Props = {
  activeCount: number;
  leadsCount?: number;
  archivedCount?: number;
};

export function DashboardViewSelector({
  activeCount,
  leadsCount = 0,
  archivedCount = 0,
}: Props) {
  return (
    <div className="bg-white px-6 py-3 border-b border-neutral-200 flex gap-2">
      <ViewTab icon={FolderOpen} label="תיקים פעילים" count={activeCount} active />
      <ViewTab icon={Sprout} label="לידים" count={leadsCount} />
      <ViewTab icon={Archive} label="ארכיון" count={archivedCount} />
    </div>
  );
}

function ViewTab({
  icon: Icon,
  label,
  count,
  active,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  count: number;
  active?: boolean;
}) {
  return (
    <button
      type="button"
      className={[
        'inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition',
        active
          ? 'bg-[#0A0A0A] text-white'
          : 'bg-neutral-50 border border-neutral-200 text-neutral-600 hover:border-[#C9A961] hover:text-[#0A0A0A]',
      ].join(' ')}
    >
      <Icon className="size-4" />
      <span>{label}</span>
      {count > 0 && (
        <span
          className={[
            'inline-flex items-center justify-center min-w-5 h-5 px-1.5 rounded-full text-[10px] font-bold',
            active ? 'bg-[#C9A961] text-[#0A0A0A]' : 'bg-neutral-200 text-neutral-700',
          ].join(' ')}
        >
          {count}
        </span>
      )}
    </button>
  );
}
