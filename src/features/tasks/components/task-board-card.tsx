'use client';

import Link from 'next/link';

import { useDraggable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { AlertTriangle, GripVertical } from 'lucide-react';

import type { Locale } from '@/lib/i18n/direction';

import { formatDueDate, isOverdue, priorityEdgeColor } from '../domain/task-state';
import { TaskTagChips } from './task-tag-chips';
import type { TaskWithRelations } from '../types';

type Props = { task: TaskWithRelations; locale: Locale };

export function TaskBoardCard({ task, locale }: Props) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: task.id,
  });

  const overdue = isOverdue(task);
  const due = formatDueDate(task.due_date, locale);
  const assignee = task.assignee
    ? [task.assignee.first_name, task.assignee.last_name].filter(Boolean).join(' ').trim()
    : null;
  const initials =
    (task.assignee?.first_name?.[0] ?? '') + (task.assignee?.last_name?.[0] ?? '') || '?';

  const style: React.CSSProperties = {
    transform: CSS.Translate.toString(transform),
    opacity: isDragging ? 0.4 : 1,
    borderInlineStartColor: priorityEdgeColor(task.priority),
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className="group rounded-lg border border-neutral-200 border-s-4 bg-white p-3 shadow-sm cursor-grab active:cursor-grabbing touch-none"
    >
      <div className="flex items-start gap-1.5">
        <GripVertical className="size-3.5 text-neutral-300 mt-0.5 shrink-0 group-hover:text-neutral-400" />
        <p className="text-sm font-medium text-neutral-800 leading-snug flex-1">{task.title}</p>
      </div>

      {task.tags.length > 0 && (
        <div className="mt-2 ps-5">
          <TaskTagChips tags={task.tags} />
        </div>
      )}

      <div className="flex items-center justify-between gap-2 mt-2 ps-5">
        <div className="flex items-center gap-2 min-w-0">
          {task.case && (
            <Link
              href={`/cases/${task.case.id}`}
              onPointerDown={(e) => e.stopPropagation()}
              className="text-xs font-mono text-[#A88840] hover:text-[#0A0A0A] transition shrink-0"
            >
              #{task.case.case_number}
            </Link>
          )}
          {due && (
            <span
              className={[
                'inline-flex items-center gap-1 text-xs',
                overdue ? 'text-red-600 font-medium' : 'text-neutral-400',
              ].join(' ')}
            >
              {overdue && <AlertTriangle className="size-3" />}
              {due}
            </span>
          )}
        </div>
        {assignee && (
          <span
            title={assignee}
            className="size-6 rounded-full bg-[#0A0A0A] text-[#C9A961] text-[10px] font-bold flex items-center justify-center shrink-0"
          >
            {initials}
          </span>
        )}
      </div>
    </div>
  );
}
