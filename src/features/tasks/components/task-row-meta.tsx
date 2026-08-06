'use client';

import Link from 'next/link';

import { Calendar, Clock, User, UserRoundCheck } from 'lucide-react';
import { useTranslations } from 'next-intl';

import type { Locale } from '@/lib/i18n/direction';
import { formatPersonName } from '@/lib/utils/person-name';

import { formatDueDate, formatSnoozeTime } from '../domain/task-state';

import type { TaskWithRelations } from '../types';

type Props = {
  task: TaskWithRelations;
  locale: Locale;
  overdue: boolean;
  /** In the case popover the linked case is the page you're on — drop it. */
  hideCaseLink?: boolean;
};

/** The task's who / when footline: assignee, assigner, due date, case, snooze. */
export function TaskRowMeta({ task, locale, overdue, hideCaseLink = false }: Props) {
  const t = useTranslations('tasks');
  const assigneeName =
    formatPersonName(task.assignee?.first_name, task.assignee?.last_name) || t('unassigned');
  const assignerName =
    formatPersonName(task.assigner?.first_name, task.assigner?.last_name) ||
    (task.assigned_by ? t('assignment.unknownPerson') : t('assignment.system'));

  return (
    <div className="flex items-center gap-3 mt-1.5 text-[11px] text-neutral-500 flex-wrap">
      <span className="inline-flex items-center gap-1">
        <User className="size-3" />
        {assigneeName}
      </span>
      {task.assigned_to && (
        <span
          className="inline-flex items-center gap-1"
          title={t('assignment.assignedBy', { name: assignerName })}
        >
          <UserRoundCheck className="size-3" />
          {t('assignment.assignedBy', { name: assignerName })}
        </span>
      )}
      {task.due_date && (
        <span
          className={['inline-flex items-center gap-1', overdue ? 'text-red-600 font-medium' : ''].join(' ')}
        >
          <Calendar className="size-3" />
          {formatDueDate(task.due_date, locale)}
        </span>
      )}
      {task.case && !hideCaseLink && (
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
  );
}
