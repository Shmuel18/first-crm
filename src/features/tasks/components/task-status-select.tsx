'use client';

import { useTranslations } from 'next-intl';

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

import { statusBadgeClass } from '../domain/task-state';

import type { TaskStatus } from '../types';

// Offered from the row's status badge (parity with the board columns). Snooze
// isn't here — it has its own timed "remind me" control.
const LIST_STATUSES: readonly TaskStatus[] = ['pending', 'in_progress', 'completed', 'cancelled'];

/** The task's status as a badge that doubles as its change-status menu. */
export function TaskStatusSelect({
  status,
  onChange,
}: {
  status: TaskStatus;
  onChange: (next: TaskStatus) => void;
}) {
  const t = useTranslations('tasks');
  const ts = useTranslations('tasks.status');

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <button
            type="button"
            aria-label={t('changeStatus')}
            className={[
              'inline-flex items-center gap-1.5 ps-1.5 pe-2 h-5 rounded-full text-xs font-medium border transition hover:brightness-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold-text/40',
              statusBadgeClass(status),
            ].join(' ')}
          />
        }
      >
        <span className="size-1.5 rounded-full bg-current opacity-55" />
        {ts(status)}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="min-w-32">
        {LIST_STATUSES.filter((s) => s !== status).map((s) => (
          <DropdownMenuItem key={s} onClick={() => onChange(s)}>
            {ts(s)}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
