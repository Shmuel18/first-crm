'use client';

import { useTranslations } from 'next-intl';

import { TAG_COLOR } from '../domain/task-tags';
import type { TaskTag } from '../types';

type Props = { tags: ReadonlyArray<TaskTag> };

export function TaskTagChips({ tags }: Props) {
  const t = useTranslations('tasks.tags');
  if (tags.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-1">
      {tags.map((tag) => (
        <span
          key={tag}
          className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] bg-neutral-100 text-neutral-600"
        >
          <span className="size-1.5 rounded-full" style={{ background: TAG_COLOR[tag] }} />
          {t(tag)}
        </span>
      ))}
    </div>
  );
}
