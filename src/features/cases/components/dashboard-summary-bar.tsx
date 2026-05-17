import { FolderOpen, Sprout, Star } from 'lucide-react';

type Props = {
  total: number;
  stuck: number;
  newThisWeek: number;
};

export function DashboardSummaryBar({ total, stuck, newThisWeek }: Props) {
  return (
    <div className="bg-white px-6 py-3 border-b border-neutral-200">
      <div className="flex items-center gap-6 text-sm flex-wrap">
        <SummaryItem icon={FolderOpen} label="תיקים פעילים" value={total} accent="#0A0A0A" />
        <Divider />
        <SummaryItem
          icon={Star}
          label="תקועים"
          value={stuck}
          accent={stuck > 0 ? '#DC2626' : '#0A0A0A'}
        />
        <Divider />
        <SummaryItem icon={Sprout} label="חדשים השבוע" value={newThisWeek} accent="#10B981" />
        <Divider />
        <span className="text-neutral-500">מציג {total}</span>
      </div>
    </div>
  );
}

function SummaryItem({
  icon: Icon,
  label,
  value,
  accent,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: number;
  accent: string;
}) {
  return (
    <div className="inline-flex items-center gap-2" style={{ color: accent }}>
      <Icon className="size-4" />
      <span className="font-bold tabular-nums">{value}</span>
      <span className="text-neutral-600">{label}</span>
    </div>
  );
}

function Divider() {
  return <span className="text-neutral-300">·</span>;
}
