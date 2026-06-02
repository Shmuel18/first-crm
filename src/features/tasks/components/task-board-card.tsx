'use client';

import { useState, useTransition } from 'react';

import Link from 'next/link';

import { useDraggable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { AlertTriangle, GripVertical, Lock, MessageSquare, MoreHorizontal, Trash2, UserPlus } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';

import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import type { Locale } from '@/lib/i18n/direction';
import { formatPersonName } from '@/lib/utils/person-name';

import { deleteTaskAction } from '../actions/delete-task';
import { formatDueDate, isImmediateTask, isOverdue, priorityEdgeColor } from '../domain/task-state';
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
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: task.id,
  });

  const overdue = isOverdue(task);
  const immediate = isImmediateTask(task);
  const due = formatDueDate(task.due_date, locale);
  const assignee = task.assignee
    ? formatPersonName(task.assignee.first_name, task.assignee.last_name)
    : null;
  const initials =
    (task.assignee?.first_name?.[0] ?? '') + (task.assignee?.last_name?.[0] ?? '') || '?';

  const style: React.CSSProperties = {
    transform: CSS.Translate.toString(transform),
    opacity: isDragging ? 0.4 : 1,
    borderInlineStartColor: priorityEdgeColor(task.priority),
  };

  // Self-contained delete: deleteTaskAction revalidates /tasks, so the board
  // re-renders without this card (same path the list row uses).
  const handleDelete = () => {
    startTransition(async () => {
      const res = await deleteTaskAction(task.id);
      if (!res.ok) {
        toast.error(t('toast.deleteFailed'));
      } else {
        toast.success(t('toast.deleted'));
        setConfirmOpen(false);
      }
    });
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      onClick={() => onOpen(task)}
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
            className="-mt-0.5 shrink-0 text-neutral-300 opacity-0 transition hover:text-brand-gold-text focus-visible:opacity-100 group-hover:opacity-100"
          >
            <MessageSquare className="size-4" aria-hidden="true" />
          </button>
        )}
        {/* ⋯ menu — reassign (non-private) + delete. Stops propagation so it
            doesn't open the edit dialog or start a drag. */}
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <button
                type="button"
                aria-label={tc('more')}
                onClick={(e) => e.stopPropagation()}
                onPointerDown={(e) => e.stopPropagation()}
                className="-mt-0.5 shrink-0 text-neutral-300 opacity-0 transition hover:text-neutral-600 focus-visible:opacity-100 group-hover:opacity-100"
              />
            }
          >
            <MoreHorizontal className="size-4" />
          </DropdownMenuTrigger>
          {/* stopPropagation on the content: menu items are portaled to <body>
              but React bubbles their click events through the REACT tree — up to
              the card's onClick (onOpen) — so clicking delete/reassign also
              opened the edit dialog. Stop it at the menu so only the item's own
              handler runs. */}
          <DropdownMenuContent
            align="end"
            className="min-w-32"
            onClick={(e) => e.stopPropagation()}
          >
            {onReassign && !task.is_private && (
              <DropdownMenuItem onClick={() => onReassign(task)}>
                <UserPlus className="size-3.5 me-2" />
                {t('reassign')}
              </DropdownMenuItem>
            )}
            <DropdownMenuItem
              onClick={() => setConfirmOpen(true)}
              className="text-red-600 focus:text-red-700 focus:bg-red-50"
            >
              <Trash2 className="size-3.5 me-2" />
              {tc('delete')}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

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

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        {/* Same portal-bubbling guard: the confirm/cancel buttons are portaled
            but bubble through the React tree to the card's onClick, which
            re-opened the edit dialog on confirm. Stop it at the dialog. */}
        <AlertDialogContent onClick={(e) => e.stopPropagation()}>
          <AlertDialogTitle>{t('deleteDialog.title')}</AlertDialogTitle>
          <AlertDialogDescription>
            {t('deleteDialog.description', { title: task.title })}
          </AlertDialogDescription>
          <AlertDialogFooter>
            <Button variant="destructive" onClick={handleDelete} disabled={pending}>
              {tc('delete')}
            </Button>
            <AlertDialogCancel render={<Button variant="outline">{tc('cancel')}</Button>} />
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
