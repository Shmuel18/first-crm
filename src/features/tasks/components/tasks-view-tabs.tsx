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
    <div className="flex flex-wrap gap-2">
      {views.map((view) => {
        const active = view === currentView;
        const count = counts?.[view];
        return (
          <Link
            key={view}
            href={view === 'mine' ? '/tasks' : `/tasks?view=${view}`}
            scroll={false}
            className={[
              'inline-flex items-center gap-2 px-4 h-9 rounded-lg text-sm font-medium transition',
              active
                ? 'bg-[#0A0A0A] text-white shadow-sm'
                : 'bg-neutral-50 border border-neutral-200 text-neutral-600 hover:border-[#C9A961] hover:text-[#0A0A0A]',
            ].join(' ')}
          >
            {t(view)}
            {count !== undefined && count > 0 && (
              <span
                className={[
                  'inline-flex items-center justify-center min-w-5 h-5 px-1.5 rounded-full text-[10px] font-bold tabular-nums',
                  active ? 'bg-[#C9A961] text-[#0A0A0A]' : 'bg-neutral-200 text-neutral-700',
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
