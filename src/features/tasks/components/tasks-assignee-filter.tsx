'use client';

import { UserCheck } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { parseAsArrayOf, parseAsString, useQueryState } from 'nuqs';

import { MultiSelectFilter, type MultiSelectOption } from '@/components/shared/multi-select-filter';
import { formatPersonName } from '@/lib/utils/person-name';

import type { TaskAssignee } from '../types';

type Props = { assignees: ReadonlyArray<TaskAssignee> };

const listParser = parseAsArrayOf(parseAsString).withOptions({ shallow: false });
const EMPTY: string[] = [];

/**
 * Filter the task list by the teammates a task is assigned to — several at a
 * time. Writes the `?assignee=` URL param as one comma-joined list (shallow:
 * false so the server refetches with the narrowed `assignedTo` filter).
 * Rendered only in the "assigned by me" / "all" views — in "mine" every task is
 * the caller's, so a per-assignee filter is moot.
 */
export function TasksAssigneeFilter({ assignees }: Props) {
  const t = useTranslations('tasks.assigneeFilter');
  const [assignee, setAssignee] = useQueryState('assignee', listParser);

  const named: MultiSelectOption[] = assignees
    .map((a) => ({ id: a.id, name: formatPersonName(a.first_name, a.last_name) }))
    .filter((a) => a.name.length > 0);

  return (
    <MultiSelectFilter
      label={t('label')}
      values={assignee ?? EMPTY}
      onChange={(next) => setAssignee(next.length > 0 ? next : null)}
      options={named}
      allLabel={t('all')}
      align="end"
      icon={<UserCheck className="size-3.5 text-neutral-500" aria-hidden="true" />}
    />
  );
}
