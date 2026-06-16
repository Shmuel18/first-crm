'use client';

import { ChevronDown, UserCheck } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useQueryState } from 'nuqs';

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { formatPersonName } from '@/lib/utils/person-name';

import type { TaskAssignee } from '../types';

type Props = { assignees: ReadonlyArray<TaskAssignee> };

/**
 * Filter the task list by the teammate a task is assigned to. Writes the
 * `?assignee=` URL param (shallow:false so the server refetches with the
 * narrowed `assignedTo` filter). Rendered only in the "assigned by me" / "all"
 * views — in "mine" every task is the caller's, so a per-assignee filter is moot.
 */
export function TasksAssigneeFilter({ assignees }: Props) {
  const t = useTranslations('tasks.assigneeFilter');
  const [assignee, setAssignee] = useQueryState('assignee', { shallow: false });

  const named = assignees
    .map((a) => ({ id: a.id, name: formatPersonName(a.first_name, a.last_name) }))
    .filter((a) => a.name.length > 0);

  const current = named.find((a) => a.id === assignee);
  const triggerText = current ? current.name : t('all');

  const onValue = (value: string): void => {
    setAssignee(value === '' ? null : value);
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <button
            type="button"
            aria-label={`${t('label')}: ${triggerText}`}
            className="inline-flex items-center gap-1.5 rounded-md border border-neutral-200 bg-white px-2.5 py-1.5 text-xs text-neutral-700 transition hover:border-neutral-300 hover:bg-neutral-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold-text/40"
          />
        }
      >
        <UserCheck className="size-3.5 text-neutral-500" aria-hidden="true" />
        <span>{triggerText}</span>
        <ChevronDown className="size-3 text-neutral-500" aria-hidden="true" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="max-h-72 min-w-48 overflow-y-auto">
        <DropdownMenuRadioGroup value={assignee ?? ''} onValueChange={onValue}>
          <DropdownMenuRadioItem value="">{t('all')}</DropdownMenuRadioItem>
          {named.map((a) => (
            <DropdownMenuRadioItem key={a.id} value={a.id}>
              {a.name}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
