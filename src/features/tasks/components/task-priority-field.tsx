'use client';

import { useTranslations } from 'next-intl';

import { cn } from '@/lib/utils';

import { TASK_PRIORITY_VALUES, type TaskPriority } from '../types';

// Selected colors mirror PRIORITY_BADGE in domain/task-state so the urgency you
// pick in the form looks identical to how it reads in the list and board.
const SELECTED: Record<TaskPriority, string> = {
  critical: 'peer-checked:border-red-600 peer-checked:bg-red-600 peer-checked:text-white',
  high: 'peer-checked:border-red-300 peer-checked:bg-red-100 peer-checked:text-red-800',
  normal: 'peer-checked:border-amber-300 peer-checked:bg-amber-50 peer-checked:text-amber-800',
  low: 'peer-checked:border-neutral-400 peer-checked:bg-neutral-100 peer-checked:text-neutral-800',
};

type Props = {
  name: string;
  defaultValue: TaskPriority;
};

/**
 * Color-coded priority selector — a native radio group styled as segmented
 * chips. Uncontrolled (submits as `name`, re-seeds from defaultValue when the
 * dialog popup remounts on open), accessible (real radios, keyboard + focus
 * ring), and bilingual/RTL via the grid.
 */
export function TaskPriorityField({ name, defaultValue }: Props) {
  const tp = useTranslations('tasks.priority');
  return (
    <div role="radiogroup" className="grid grid-cols-2 gap-2 sm:grid-cols-4">
      {TASK_PRIORITY_VALUES.map((p) => (
        <label key={p} className="relative block cursor-pointer">
          <input
            type="radio"
            name={name}
            value={p}
            defaultChecked={p === defaultValue}
            className="peer sr-only"
          />
          <span
            className={cn(
              'flex items-center justify-center rounded-md border border-neutral-200 bg-white px-2 py-2 text-xs font-medium text-neutral-600 transition hover:bg-neutral-50 peer-focus-visible:ring-2 peer-focus-visible:ring-brand-gold-text/40',
              SELECTED[p],
            )}
          >
            {tp(p)}
          </span>
        </label>
      ))}
    </div>
  );
}
