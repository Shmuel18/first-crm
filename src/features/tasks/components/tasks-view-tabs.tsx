import Link from 'next/link';

import { getTranslations } from 'next-intl/server';

import { TASK_VIEW_VALUES, type TaskView } from '../types';

type Props = {
  currentView: TaskView;
  isAdmin: boolean;
  counts?: Partial<Record<TaskView, number>>;
};

export async function TasksViewTabs({ currentView, isAdmin, counts }: Props) {
  const t = await getTranslations('tasks.views');

  const views = TASK_VIEW_VALUES.filter((v) => (v === 'all' ? isAdmin : true));

  return (
    <div className="inline-flex items-center gap-1 p-1 bg-neutral-100 rounded-lg">
      {views.map((view) => {
        const active = view === currentView;
        const count = counts?.[view];
        return (
          <Link
            key={view}
            href={view === 'mine' ? '/tasks' : `/tasks?view=${view}`}
            scroll={false}
            className={[
              'inline-flex items-center gap-1.5 px-3 h-8 rounded-md text-sm font-medium transition-colors',
              active
                ? 'bg-white text-neutral-900 shadow-sm'
                : 'text-neutral-600 hover:text-neutral-900',
            ].join(' ')}
          >
            {t(view)}
            {count !== undefined && count > 0 && (
              <span
                className={[
                  'inline-flex items-center justify-center min-w-4 h-4 px-1 rounded-full text-[10px] font-semibold',
                  active ? 'bg-[#C9A961] text-white' : 'bg-neutral-200 text-neutral-700',
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
