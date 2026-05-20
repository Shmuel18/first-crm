'use client';

import { useTranslations } from 'next-intl';
import { parseAsString, useQueryState } from 'nuqs';

import { TAG_COLOR } from '../domain/task-tags';
import { TASK_TAG_VALUES } from '../types';

export function TasksTagFilter() {
  const t = useTranslations('tasks.tags');
  const [tag, setTag] = useQueryState('tag', parseAsString.withOptions({ shallow: false }));

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <Pill active={!tag} label={t('all')} onClick={() => setTag(null)} />
      {TASK_TAG_VALUES.map((value) => (
        <Pill
          key={value}
          active={tag === value}
          label={t(value)}
          color={TAG_COLOR[value]}
          onClick={() => setTag(tag === value ? null : value)}
        />
      ))}
    </div>
  );
}

function Pill({
  active,
  label,
  color,
  onClick,
}: {
  active: boolean;
  label: string;
  color?: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={[
        'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-medium transition',
        active
          ? 'border-[#C9A961] bg-[#0A0A0A] text-white'
          : 'border-neutral-200 text-neutral-600 hover:border-[#C9A961] hover:text-[#0A0A0A]',
      ].join(' ')}
    >
      {color && <span className="size-2 rounded-full" style={{ background: color }} />}
      {label}
    </button>
  );
}
