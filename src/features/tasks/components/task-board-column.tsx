'use client';

import { useDroppable } from '@dnd-kit/core';

import type { Locale } from '@/lib/i18n/direction';

import { TaskBoardCard } from './task-board-card';
import type { TaskStatus, TaskWithRelations } from '../types';

const ACCENT: Record<TaskStatus, string> = {
  pending: '#C9A961',
  in_progress: '#6366F1',
  snoozed: '#F59E0B',
  completed: '#10B981',
  cancelled: '#A1A1AA',
};

type Props = {
  status: TaskStatus;
  label: string;
  tasks: ReadonlyArray<TaskWithRelations>;
  locale: Locale;
  emptyLabel: string;
  onOpen: (task: TaskWithRelations) => void;
  onReassign?: (task: TaskWithRelations) => void;
  onThread?: (task: TaskWithRelations) => void;
};

export function TaskBoardColumn({
  status,
  label,
  tasks,
  locale,
  emptyLabel,
  onOpen,
  onReassign,
  onThread,
}: Props) {
  const { setNodeRef, isOver } = useDroppable({ id: status });

  return (
    <div
      ref={setNodeRef}
      className={[
        'rounded-xl border p-2 transition-colors min-h-40',
        isOver ? 'border-brand-gold bg-brand-gold-soft' : 'border-neutral-200 bg-neutral-50/60',
      ].join(' ')}
    >
      <div className="flex items-center gap-2 px-2 py-1.5">
        <span className="size-2.5 rounded-full shrink-0" style={{ background: ACCENT[status] }} />
        <span className="text-sm font-semibold text-neutral-700">{label}</span>
        <span className="ms-auto text-xs font-medium text-neutral-400 tabular-nums">
          {tasks.length}
        </span>
      </div>

      <div className="space-y-2 mt-1">
        {tasks.length === 0 ? (
          <p className="px-2 py-6 text-center text-xs text-neutral-300">{emptyLabel}</p>
        ) : (
          tasks.map((task) => (
            <TaskBoardCard
              key={task.id}
              task={task}
              locale={locale}
              onOpen={onOpen}
              onReassign={onReassign}
              onThread={onThread}
            />
          ))
        )}
      </div>
    </div>
  );
}
