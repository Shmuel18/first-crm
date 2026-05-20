'use client';

import { LayoutGrid, List } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { parseAsStringEnum, useQueryState } from 'nuqs';

const DISPLAYS = ['board', 'list'] as const;

export function TasksLayoutToggle() {
  const t = useTranslations('tasks.board');
  const [display, setDisplay] = useQueryState(
    'display',
    parseAsStringEnum([...DISPLAYS]).withDefault('board').withOptions({ shallow: false }),
  );

  return (
    <div className="inline-flex rounded-lg border border-neutral-200 overflow-hidden shrink-0">
      <ToggleButton
        active={display === 'board'}
        onClick={() => setDisplay('board')}
        icon={LayoutGrid}
        label={t('board')}
      />
      <ToggleButton
        active={display === 'list'}
        onClick={() => setDisplay('list')}
        icon={List}
        label={t('list')}
      />
    </div>
  );
}

function ToggleButton({
  active,
  onClick,
  icon: Icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={[
        'inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium transition',
        active ? 'bg-[#0A0A0A] text-white' : 'bg-white text-neutral-600 hover:bg-neutral-50',
      ].join(' ')}
    >
      <Icon className="size-4" />
      {label}
    </button>
  );
}
