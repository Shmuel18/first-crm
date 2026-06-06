import Link from 'next/link';

import { getTranslations } from 'next-intl/server';

import { TASK_VIEW_VALUES, type TaskView } from '../types';

type Props = {
  currentView: TaskView;
  /** Show the office-wide "all" tab — true for view_all_cases holders. */
  canViewAllTasks: boolean;
  counts?: Partial<Record<TaskView, number>>;
};

export async function TasksViewTabs({ currentView, canViewAllTasks, counts }: Props) {
  const t = await getTranslations('tasks.views');

  const views = TASK_VIEW_VALUES.filter((v) => (v === 'all' ? canViewAllTasks : true));

  return (
    <div className="flex flex-wrap gap-1 border-b border-neutral-200">
      {views.map((view) => {
        const active = view === currentView;
        const count = counts?.[view];
        return (
          <Link
            key={view}
            href={view === 'mine' ? '/tasks' : `/tasks?view=${view}`}
            scroll={false}
            className={[
              'inline-flex items-center gap-2 px-4 py-2.5 -mb-px border-b-2 text-sm font-medium transition-colors',
              active
                ? 'border-brand-gold text-neutral-900'
                : 'border-transparent text-neutral-500 hover:text-neutral-800',
            ].join(' ')}
          >
            {t(view)}
            {count !== undefined && count > 0 && (
              <span
                className={[
                  'inline-flex items-center justify-center min-w-5 h-5 px-1.5 rounded-full text-[10px] font-bold tabular-nums',
                  active ? 'bg-brand-gold-tint text-brand-gold-text' : 'bg-neutral-100 text-neutral-600',
                ].join(' ')}
              >
                {count}
              </span>
            )}
          </Link>
        );
      })}
    </div>
  );
}
