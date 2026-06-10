'use client';

import type { CSSProperties } from 'react';

import Link from 'next/link';

import { useDraggable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { AlertTriangle, GripVertical, Lock, MessageSquare, UserRoundCheck } from 'lucide-react';
import { useTranslations } from 'next-intl';

import type { Locale } from '@/lib/i18n/direction';
import { formatPersonName } from '@/lib/utils/person-name';

import { formatDueDate, isImmediateTask, isOverdue, priorityEdgeColor } from '../domain/task-state';
import { TaskActionsMenu } from './task-actions-menu';

import type { TaskWithRelations } from '../types';

type Props = {
  task: TaskWithRelations;
  locale: Locale;
  onOpen: (task: TaskWithRelations) => void;
  onReassign?: (task: TaskWithRelations) => void;
  onThread?: (task: TaskWithRelations) => void;
};

export function TaskBoardCard({ task, locale, onOpen, onReassign, onThread }: Props) {
  const t = useTranslations('tasks');
  const tc = useTranslations('common');
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: task.id,
  });

  const overdue = isOverdue(task);
  const immediate = isImmediateTask(task);
  const due = formatDueDate(task.due_date, locale);
  const assignee = task.assignee
    ? formatPersonName(task.assignee.first_name, task.assignee.last_name)
    : null;
  const assigner =
    formatPersonName(task.assigner?.first_name, task.assigner?.last_name) ||
    (task.assigned_by ? t('assignment.unknownPerson') : t('assignment.system'));
  const initials =
    (task.assignee?.first_name?.[0] ?? '') + (task.assignee?.last_name?.[0] ?? '') || '?';

  const style: CSSProperties = {
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
      onClick={(e) => {
        // Open the editor only for a click on the card's OWN content. The ⋯
        // menu, the delete-confirm dialog, and its full-screen backdrop are
        // portaled to <body> but bubble through the REACT tree to this onClick
        // — so a click on the backdrop (i.e. anywhere while the confirm is
        // open) was opening the editor. Ignore anything originating inside a
        // Base UI portal / overlay.
        const el = e.target as HTMLElement;
        if (el.closest('[data-base-ui-portal],[role="menu"],[role="dialog"],[role="alertdialog"]')) {
          return;
        }
        onOpen(task);
      }}
      className={[
        'group rounded-lg border border-neutral-200 border-s-4 bg-white p-3 shadow-sm cursor-pointer active:cursor-grabbing touch-none',
        immediate ? 'task-critical-surface bg-red-50/70 border-red-200' : '',
      ].join(' ')}
    >
      <div className="flex items-start gap-1.5">
        <GripVertical className="size-3.5 text-neutral-300 mt-0.5 shrink-0 group-hover:text-neutral-400" />
        <p className="text-sm font-medium text-neutral-800 leading-snug flex-1">{task.title}</p>
        {task.is_private && (
          <Lock className="size-3 text-brand-gold-text shrink-0 mt-1" aria-label={t('privateLabel')} />
        )}
        {immediate && (
          <span
            aria-hidden="true"
            className="task-critical-dot size-2 rounded-full bg-red-600 shrink-0 mt-1.5"
          />
        )}
        {/* Thread button. Stops propagation (click + pointerdown) so it doesn't
            open the edit dialog or start a drag. */}
        {onThread && (
          <button
            type="button"
            aria-label={t('thread.open')}
            onClick={(e) => {
              e.stopPropagation();
              onThread(task);
            }}
            onPointerDown={(e) => e.stopPropagation()}
            className="-mt-0.5 shrink-0 text-neutral-300 transition hover:text-brand-gold-text opacity-100 md:opacity-0 md:group-hover:opacity-100 md:focus-visible:opacity-100"
          >
            <MessageSquare className="size-4" aria-hidden="true" />
          </button>
        )}
        {/* Shared ⋯ menu — edit / reassign / snooze / delete, identical to the
            list row (TaskActionsMenu owns the delete-confirm dialog too). The
            trigger stops click + pointer propagation so opening the menu never
            starts a drag or opens the card editor. */}
        <TaskActionsMenu
          task={task}
          onEdit={onOpen}
          onReassign={onReassign}
          trigger={
            <button
              type="button"
              aria-label={tc('more')}
              onClick={(e) => e.stopPropagation()}
              onPointerDown={(e) => e.stopPropagation()}
              className="-mt-0.5 shrink-0 text-neutral-300 transition hover:text-neutral-600 opacity-100 md:opacity-0 md:group-hover:opacity-100 md:focus-visible:opacity-100"
            />
          }
        />
      </div>

      {task.assigned_to && (
        <div
          className="mt-2 flex items-center gap-1 ps-5 text-[10px] text-neutral-500"
          title={t('assignment.assignedBy', { name: assigner })}
        >
          <UserRoundCheck className="size-3 shrink-0" aria-hidden="true" />
          <span className="truncate">{t('assignment.assignedBy', { name: assigner })}</span>
        </div>
      )}

      <div className="flex items-center justify-between gap-2 mt-2 ps-5">
        <div className="flex items-center gap-2 min-w-0">
          {task.case && (
            <Link
              href={`/cases/${task.case.id}`}
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => e.stopPropagation()}
              className="text-xs font-medium text-brand-gold-text hover:text-brand-black transition truncate min-w-0"
            >
              {task.case.clientName ?? `#${task.case.case_number}`}
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
          <span className="flex items-center gap-1.5 shrink-0 max-w-[55%]" title={assignee}>
            <span className="size-5 rounded-full bg-brand-black text-brand-gold text-[9px] font-bold flex items-center justify-center shrink-0">
              {initials}
            </span>
            <span className="truncate text-[11px] text-neutral-600">{assignee}</span>
          </span>
        )}
      </div>
    </div>
  );
}
