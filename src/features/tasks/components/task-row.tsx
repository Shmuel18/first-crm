'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';

import { AlertTriangle, Lock, MessageSquare } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import type { Locale } from '@/lib/i18n/direction';

import { changeTaskStatusAction } from '../actions/change-task-status';
import { completeTaskAction } from '../actions/complete-task';
import { reopenTaskAction } from '../actions/reopen-task';
import {
  isImmediateTask,
  isOverdue,
  priorityBadgeClass,
  priorityEdgeColor,
} from '../domain/task-state';
import { TaskActionsMenu } from './task-actions-menu';
import { TaskRowMeta } from './task-row-meta';
import { TaskStatusSelect } from './task-status-select';

import type { TaskStatus, TaskWithRelations } from '../types';

type Props = {
  task: TaskWithRelations;
  locale: Locale;
  onEdit: (task: TaskWithRelations) => void;
  onReassign?: (task: TaskWithRelations) => void;
  onThread?: (task: TaskWithRelations) => void;
  /**
   * Rendered inside the case action-bar popover rather than the /tasks page.
   * Drops the linked-case link (it's the case you're already on) and shows the
   * description IN FULL — the popover is the office's read surface for a
   * case's tasks, so truncating the body there hid the actual instruction.
   */
  compact?: boolean;
};

export function TaskRow({ task, locale, onEdit, onReassign, onThread, compact = false }: Props) {
  const t = useTranslations('tasks');
  const tp = useTranslations('tasks.priority');
  const tc = useTranslations('common');
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  // The complete/reopen toggle runs OUTSIDE a transition so the checkbox releases
  // the moment the (now-revalidate-free) action returns; router.refresh() then
  // updates the row in the background without re-disabling the checkbox.
  const [toggleBusy, setToggleBusy] = useState(false);

  const overdue = isOverdue(task);
  const immediate = isImmediateTask(task);
  const completed = task.status === 'completed';

  const handleToggleComplete = async () => {
    if (toggleBusy) return;
    setToggleBusy(true);
    const res = completed ? await reopenTaskAction(task.id) : await completeTaskAction(task.id);
    setToggleBusy(false); // release the checkbox the instant the DB write returns
    if (!res.ok) {
      toast.error(t('toast.actionFailed'));
      return;
    }
    toast.success(completed ? t('toast.reopened') : t('toast.completed'));
    router.refresh(); // background — updates the row without re-disabling the button
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
        disabled={toggleBusy || pending}
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
              'inline-flex items-center gap-1.5 ps-1.5 pe-2 h-5 rounded-full text-xs font-medium border',
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
          {/* Status is part of "what is this task" — shown in the case popover
              too, not only on /tasks. */}
          <TaskStatusSelect status={task.status} onChange={handleStatus} />
          {overdue && (
            <span className="inline-flex items-center px-1.5 h-5 rounded-full text-xs font-medium bg-red-100 text-red-700 border border-red-200">
              {t('overdue')}
            </span>
          )}
          {task.is_private && (
            <span className="inline-flex items-center gap-1 ps-1.5 pe-2 h-5 rounded-full text-xs font-medium border border-brand-gold-dark/40 bg-brand-gold-soft text-brand-gold-text">
              <Lock className="size-3" aria-hidden="true" />
              {t('privateLabel')}
            </span>
          )}
        </div>

        {task.description && (
          <p
            className={[
              // whitespace-pre-wrap: descriptions are typed with line breaks
              // (checklists, "call X then Y"), and collapsing them turned a
              // legible list into one run-on paragraph.
              'text-xs text-neutral-600 mt-1 whitespace-pre-wrap break-words',
              // /tasks is a scanning surface → keep it to two lines. The case
              // popover is where the task is actually READ → show it all.
              compact ? '' : 'line-clamp-2',
            ].join(' ')}
          >
            {task.description}
          </p>
        )}

        <TaskRowMeta task={task} locale={locale} overdue={overdue} hideCaseLink={compact} />
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

