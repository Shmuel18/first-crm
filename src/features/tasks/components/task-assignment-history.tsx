'use client';

import { useEffect, useState, useTransition } from 'react';

import { History, Loader2, UserRoundCheck, UserRoundPlus } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';

import { formatPersonName } from '@/lib/utils/person-name';

import { getTaskAssignmentHistoryAction } from '../services/task-assignment-history.service';
import type {
  TaskAssignee,
  TaskAssignmentHistoryEntry,
  TaskWithRelations,
} from '../types';

type Props = {
  task: TaskWithRelations;
};

export function TaskAssignmentHistory({ task }: Props) {
  const t = useTranslations('tasks.assignment');
  const locale = useLocale();
  const [history, setHistory] = useState<TaskAssignmentHistoryEntry[]>([]);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    startTransition(async () => {
      const result = await getTaskAssignmentHistoryAction(task.id);
      setHistory(result.ok ? result.history : []);
    });
  }, [task.id]);

  const creatorName =
    personName(task.creator) || (task.created_by ? t('unknownPerson') : t('system'));
  const assignerName =
    personName(task.assigner) || (task.assigned_by ? t('unknownPerson') : t('system'));

  return (
    <section className="border-y border-neutral-200 py-3">
      <div className="grid grid-cols-1 gap-2 text-xs sm:grid-cols-2">
        <AssignmentFact
          icon={<UserRoundPlus className="size-3.5" aria-hidden="true" />}
          label={t('createdBy', { name: creatorName })}
          date={formatDate(task.created_at, locale)}
        />
        <AssignmentFact
          icon={<UserRoundCheck className="size-3.5" aria-hidden="true" />}
          label={
            task.assigned_to
              ? t('assignedBy', { name: assignerName })
              : t('currentlyUnassigned')
          }
          date={task.assigned_at ? formatDate(task.assigned_at, locale) : null}
        />
      </div>

      <div className="mt-3 flex items-center gap-1.5 text-xs font-semibold text-neutral-700">
        <History className="size-3.5 text-brand-gold-text" aria-hidden="true" />
        {t('historyTitle')}
      </div>

      {pending && history.length === 0 ? (
        <div className="flex items-center gap-2 py-3 text-xs text-neutral-500">
          <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
          {t('loading')}
        </div>
      ) : history.length === 0 ? (
        <p className="py-2 text-xs text-neutral-500">{t('noHistory')}</p>
      ) : (
        <ol className="mt-1.5 max-h-36 space-y-2 overflow-y-auto pe-1">
          {history.map((entry) => (
            <li key={entry.id} className="flex items-start gap-2 text-xs text-neutral-600">
              <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-brand-gold-text" />
              <span className="min-w-0">
                <span className="block text-neutral-700">{historyMessage(entry, t)}</span>
                <span className="block text-[11px] text-neutral-500">
                  {t('historyMeta', {
                    name: personName(entry.by) || t('system'),
                    date: formatDate(entry.assignedAt, locale),
                  })}
                </span>
              </span>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

function AssignmentFact({
  icon,
  label,
  date,
}: {
  icon: React.ReactNode;
  label: string;
  date: string | null;
}) {
  return (
    <div className="flex min-w-0 items-start gap-2">
      <span className="mt-0.5 shrink-0 text-brand-gold-text">{icon}</span>
      <span className="min-w-0">
        <span className="block truncate font-medium text-neutral-700" title={label}>
          {label}
        </span>
        {date && <span className="block text-[11px] text-neutral-500">{date}</span>}
      </span>
    </div>
  );
}

function historyMessage(
  entry: TaskAssignmentHistoryEntry,
  t: ReturnType<typeof useTranslations>,
): string {
  const from = personName(entry.from);
  const to = personName(entry.to);
  if (!to) return t('historyUnassigned', { from: from || t('unknownPerson') });
  if (!from) return t('historyAssigned', { to });
  return t('historyTransferred', { from, to });
}

function personName(person: TaskAssignee | null): string {
  return formatPersonName(person?.first_name, person?.last_name);
}

function formatDate(value: string, locale: string): string {
  return new Intl.DateTimeFormat(locale === 'en' ? 'en-US' : 'he-IL', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}
