'use client';

import Link from 'next/link';
import { useTransition } from 'react';

import { Calendar, MoreHorizontal, Pencil, Trash2, User } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import type { Locale } from '@/lib/i18n/direction';

import { completeTaskAction } from '../actions/complete-task';
import { deleteTaskAction } from '../actions/delete-task';
import { reopenTaskAction } from '../actions/reopen-task';
import {
  formatDueDate,
  isOverdue,
  priorityBadgeClass,
  priorityEdgeColor,
  statusBadgeClass,
} from '../domain/task-state';
import { TaskTagChips } from './task-tag-chips';
import type { TaskWithRelations } from '../types';

type Props = {
  task: TaskWithRelations;
  locale: Locale;
  onEdit: (task: TaskWithRelations) => void;
  compact?: boolean;
};

export function TaskRow({ task, locale, onEdit, compact = false }: Props) {
  const t = useTranslations('tasks');
  const tp = useTranslations('tasks.priority');
  const ts = useTranslations('tasks.status');
  const tc = useTranslations('common');
  const [pending, startTransition] = useTransition();

  const overdue = isOverdue(task);
  const completed = task.status === 'completed';
  const assigneeName =
    [task.assignee?.first_name, task.assignee?.last_name].filter(Boolean).join(' ') ||
    t('unassigned');

  const handleToggleComplete = () => {
    startTransition(async () => {
      const res = completed
        ? await reopenTaskAction(task.id)
        : await completeTaskAction(task.id);
      if (!res.ok) {
        toast.error(t('toast.actionFailed'));
      } else {
        toast.success(completed ? t('toast.reopened') : t('toast.completed'));
      }
    });
  };

  const handleDelete = () => {
    startTransition(async () => {
      const res = await deleteTaskAction(task.id);
      if (!res.ok) {
        toast.error(t('toast.deleteFailed'));
      } else {
        toast.success(t('toast.deleted'));
      }
    });
  };

  return (
    <div
      style={{
        borderInlineStartWidth: '3px',
        borderInlineStartColor: priorityEdgeColor(task.priority),
      }}
      className={[
        'group flex items-start gap-3 px-3 py-3 hover:bg-neutral-50/60 transition-colors',
        completed ? 'opacity-60' : '',
        overdue ? 'bg-red-50/30' : '',
      ].join(' ')}
    >
      <button
        type="button"
        onClick={handleToggleComplete}
        disabled={pending}
        aria-label={completed ? t('action.reopen') : t('action.complete')}
        className={[
          'mt-0.5 size-5 rounded border-2 flex items-center justify-center transition shrink-0',
          completed
            ? 'bg-brand-gold border-brand-gold text-white'
            : 'border-neutral-300 hover:border-brand-gold',
        ].join(' ')}
      >
        {completed && <CheckIcon />}
      </button>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p
            className={[
              'text-sm font-medium text-neutral-900',
              completed ? 'line-through' : '',
            ].join(' ')}
          >
            {task.title}
          </p>
          <span
            className={[
              'inline-flex items-center gap-1.5 ps-1.5 pe-2 h-5 rounded-full text-[10px] font-medium border',
              priorityBadgeClass(task.priority),
            ].join(' ')}
          >
            <span className="size-1.5 rounded-full bg-current opacity-55" />
            {tp(task.priority)}
          </span>
          {!compact && (
            <span
              className={[
                'inline-flex items-center gap-1.5 ps-1.5 pe-2 h-5 rounded-full text-[10px] font-medium border',
                statusBadgeClass(task.status),
              ].join(' ')}
            >
              <span className="size-1.5 rounded-full bg-current opacity-55" />
              {ts(task.status)}
            </span>
          )}
          {overdue && (
            <span className="inline-flex items-center px-1.5 h-5 rounded-full text-[10px] font-medium bg-red-100 text-red-700 border border-red-200">
              {t('overdue')}
            </span>
          )}
        </div>

        {task.description && !compact && (
          <p className="text-xs text-neutral-600 mt-1 line-clamp-2">{task.description}</p>
        )}

        <div className="flex items-center gap-3 mt-1.5 text-[11px] text-neutral-500 flex-wrap">
          <span className="inline-flex items-center gap-1">
            <User className="size-3" />
            {assigneeName}
          </span>
          {task.due_date && (
            <span
              className={[
                'inline-flex items-center gap-1',
                overdue ? 'text-red-600 font-medium' : '',
              ].join(' ')}
            >
              <Calendar className="size-3" />
              {formatDueDate(task.due_date, locale)}
            </span>
          )}
          {task.case && !compact && (
            <Link
              href={`/cases/${task.case.id}`}
              className="hover:text-brand-gold-text hover:underline decoration-brand-gold underline-offset-2"
            >
              #{task.case.case_number}
            </Link>
          )}
        </div>

        {task.tags.length > 0 && (
          <div className="mt-1.5">
            <TaskTagChips tags={task.tags} />
          </div>
        )}
      </div>

      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={tc('more')}
              className="opacity-0 group-hover:opacity-100 focus-visible:opacity-100 transition"
            />
          }
        >
          <MoreHorizontal className="size-4" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-36">
          <DropdownMenuItem onClick={() => onEdit(task)}>
            <Pencil className="size-3.5 me-2" />
            {tc('edit')}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={handleDelete}
            className="text-red-600 focus:text-red-700 focus:bg-red-50"
          >
            <Trash2 className="size-3.5 me-2" />
            {tc('delete')}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

function CheckIcon() {
  return (
    <svg
      className="size-3"
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="3"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polyline points="5 11 8.5 14.5 15.5 6.5" />
    </svg>
  );
}

