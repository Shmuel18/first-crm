'use client';

import { Archive, FolderOpen, Sprout } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { parseAsStringEnum, useQueryState } from 'nuqs';

import type { CaseView } from '../domain/case-filters';

type Props = {
  activeCount: number;
  leadsCount?: number;
  archivedCount?: number;
};

const VIEWS: CaseView[] = ['active', 'archive', 'leads'];

export function DashboardViewSelector({
  activeCount,
  leadsCount = 0,
  archivedCount = 0,
}: Props) {
  const t = useTranslations('dashboard.viewTabs');
  const [view, setView] = useQueryState(
    'view',
    parseAsStringEnum(VIEWS).withDefault('active').withOptions({ shallow: false }),
  );

  return (
    <div className="bg-white px-6 py-3 border-b border-neutral-200 flex gap-2">
      <ViewTab
        icon={FolderOpen}
        label={t('active')}
        count={activeCount}
        active={view === 'active'}
        onClick={() => setView('active')}
      />
      <ViewTab
        icon={Sprout}
        label={t('leads')}
        count={leadsCount}
        active={view === 'leads'}
        onClick={() => setView('leads')}
      />
      <ViewTab
        icon={Archive}
        label={t('archive')}
        count={archivedCount}
        active={view === 'archive'}
        onClick={() => setView('archive')}
      />
    </div>
  );
}

function ViewTab({
  icon: Icon,
  label,
  count,
  active,
  onClick,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  count: number;
  active?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
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
