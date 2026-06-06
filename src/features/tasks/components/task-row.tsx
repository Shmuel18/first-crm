'use client';

import Link from 'next/link';
import { useTransition } from 'react';

import { AlertTriangle, Calendar, Clock, Lock, MessageSquare, User } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import type { Locale } from '@/lib/i18n/direction';
import { formatPersonName } from '@/lib/utils/person-name';

import { changeTaskStatusAction } from '../actions/change-task-status';
import { completeTaskAction } from '../actions/complete-task';
import { reopenTaskAction } from '../actions/reopen-task';
import {
  formatDueDate,
  formatSnoozeTime,
  isImmediateTask,
  isOverdue,
  priorityBadgeClass,
  priorityEdgeColor,
  statusBadgeClass,
} from '../domain/task-state';
import { TaskActionsMenu } from './task-actions-menu';

import type { TaskStatus, TaskWithRelations } from '../types';

type Props = {
  task: TaskWithRelations;
  locale: Locale;
  onEdit: (task: TaskWithRelations) => void;
  onReassign?: (task: TaskWithRelations) => void;
  onThread?: (task: TaskWithRelations) => void;
  compact?: boolean;
};

// Statuses offered from the list's status dropdown (parity with the board
// columns). Snooze isn't here — it has its own timed "remind me" control.
const LIST_STATUSES: readonly TaskStatus[] = ['pending', 'in_progress', 'completed', 'cancelled'];

export function TaskRow({ task, locale, onEdit, onReassign, onThread, compact = false }: Props) {
  const t = useTranslations('tasks');
  const tp = useTranslations('tasks.priority');
  const ts = useTranslations('tasks.status');
  const tc = useTranslations('common');
  const [pending, startTransition] = useTransition();

  const overdue = isOverdue(task);
  const immediate = isImmediateTask(task);
  const completed = task.status === 'completed';
  const assigneeName =
    formatPersonName(task.assignee?.first_name, task.assignee?.last_name) ||
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

  const handleStatus = (status: TaskStatus) => {
    startTransition(async () => {
      const res = await changeTaskStatusAction(task.id, status);
      if (!res.ok) toast.error(t('toast.actionFailed'));
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
        immediate ? 'task-critical-surface bg-red-50/70 hover:bg-red-50' : '',
        overdue && !immediate ? 'bg-red-50/30' : '',
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
            {immediate ? (
              <AlertTriangle className="size-3" aria-hidden="true" />
            ) : (
              <span className="size-1.5 rounded-full bg-current opacity-55" />
            )}
            {tp(task.priority)}
          </span>
          {!compact && (
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <button
                    type="button"
                    aria-label={t('changeStatus')}
                    className={[
                      'inline-flex items-center gap-1.5 ps-1.5 pe-2 h-5 rounded-full text-[10px] font-medium border transition hover:brightness-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold-text/40',
                      statusBadgeClass(task.status),
                    ].join(' ')}
                  />
                }
              >
                <span className="size-1.5 rounded-full bg-current opacity-55" />
                {ts(task.status)}
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="min-w-32">
                {LIST_STATUSES.filter((s) => s !== task.status).map((s) => (
                  <DropdownMenuItem key={s} onClick={() => handleStatus(s)}>
                    {ts(s)}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
          {overdue && (
            <span className="inline-flex items-center px-1.5 h-5 rounded-full text-[10px] font-medium bg-red-100 text-red-700 border border-red-200">
              {t('overdue')}
            </span>
          )}
          {task.is_private && (
            <span className="inline-flex items-center gap-1 ps-1.5 pe-2 h-5 rounded-full text-[10px] font-medium border border-brand-gold-dark/40 bg-brand-gold-soft text-brand-gold-text">
              <Lock className="size-3" aria-hidden="true" />
              {t('privateLabel')}
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
              {task.case.clientName ?? `#${task.case.case_number}`}
            </Link>
          )}
          {task.status === 'snoozed' && task.snoozed_until && (
            <span className="inline-flex items-center gap-1 text-orange-600">
              <Clock className="size-3" />
              {t('snoozedUntil', { time: formatSnoozeTime(task.snoozed_until, locale) })}
            </span>
          )}
        </div>

      </div>

      {onThread && (
        <button
          type="button"
          onClick={() => onThread(task)}
          aria-label={t('thread.open')}
          // Touch devices have no hover: always visible < md, hover-reveal at md+.
          className="shrink-0 opacity-100 md:opacity-0 md:group-hover:opacity-100 md:focus-visible:opacity-100 transition p-1 rounded text-neutral-400 hover:text-brand-gold-text hover:bg-brand-gold-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold-text/40"
        >
          <MessageSquare className="size-4" aria-hidden="true" />
        </button>
      )}

      <TaskActionsMenu
        task={task}
        onEdit={onEdit}
        onReassign={onReassign}
        trigger={
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={tc('more')}
            className="opacity-100 md:opacity-0 md:group-hover:opacity-100 md:focus-visible:opacity-100 transition"
          />
        }
      />
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

