'use client';

import { useTranslations } from 'next-intl';

import { TAG_COLOR } from '../domain/task-tags';
import { TASK_TAG_VALUES } from '../types';

type Props = { defaultTags: ReadonlyArray<string> };

/**
 * Multi-select tag chips. Pure CSS toggle (peer-checked) over real checkboxes
 * named "tags", so the form submits them via FormData.getAll('tags').
 */
export function TaskTagPicker({ defaultTags }: Props) {
  const t = useTranslations('tasks.tags');

  return (
    <div className="flex flex-wrap gap-1.5">
      {TASK_TAG_VALUES.map((tag) => (
        <label key={tag} className="cursor-pointer">
          <input
            type="checkbox"
            name="tags"
            value={tag}
            defaultChecked={defaultTags.includes(tag)}
            className="peer sr-only"
          />
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-neutral-200 text-xs text-neutral-600 transition peer-checked:border-[#C9A961] peer-checked:bg-[#FAF8F3] peer-checked:text-[#0A0A0A] peer-focus-visible:ring-2 peer-focus-visible:ring-[#C9A961]/40">
            <span className="size-2 rounded-full" style={{ background: TAG_COLOR[tag] }} />
            {t(tag)}
          </span>
        </label>
      ))}
    </div>
  );
}
