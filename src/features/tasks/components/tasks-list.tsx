'use client';

import { useState } from 'react';

import { ClipboardList, Plus } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { Button } from '@/components/ui/button';
import type { Locale } from '@/lib/i18n/direction';

import { TaskFormDialog } from './task-form-dialog';
import { TaskRow } from './task-row';
import { TASK_STATUS_VALUES, type TaskStatus, type TaskWithRelations } from '../types';

type Profile = { id: string; first_name: string | null; last_name: string | null };
type CaseOption = { id: string; case_number: string; label: string };

// Section order + accent dot for the grouped (full) list view.
const GROUP_ORDER: readonly TaskStatus[] = TASK_STATUS_VALUES;
const STATUS_COLOR: Record<TaskStatus, string> = {
  pending: '#C9A961',
  in_progress: '#6366F1',
  snoozed: '#F59E0B',
  completed: '#10B981',
  cancelled: '#A1A1AA',
};

type Props = {
  tasks: ReadonlyArray<TaskWithRelations>;
  assignees: ReadonlyArray<Profile>;
  cases: ReadonlyArray<CaseOption>;
  locale: Locale;
  presetCaseId?: string | null;
  emptyKey?: 'empty' | 'emptyCase';
  compact?: boolean;
  hideCreateButton?: boolean;
};

export function TasksList({
  tasks,
  assignees,
  cases,
  locale,
  presetCaseId = null,
  emptyKey = 'empty',
  compact = false,
  hideCreateButton = false,
}: Props) {
  const t = useTranslations('tasks');
  const ts = useTranslations('tasks.status');
  const [dialogState, setDialogState] = useState<
    { mode: 'create' } | { mode: 'edit'; task: TaskWithRelations } | null
  >(null);

  const renderRow = (task: TaskWithRelations) => (
    <TaskRow
      key={task.id}
      task={task}
      locale={locale}
      compact={compact}
      onEdit={(target) => setDialogState({ mode: 'edit', task: target })}
    />
  );

  // Full view groups by status; the compact (case-block) view stays flat.
  const groups = GROUP_ORDER.map((status) => ({
    status,
    items: tasks.filter((task) => task.status === status),
  })).filter((group) => group.items.length > 0);

  return (
    <div>
      {!hideCreateButton && (
        <div className="flex items-center justify-between mb-3">
          <Button
            type="button"
            onClick={() => setDialogState({ mode: 'create' })}
            className="bg-[#C9A961] hover:bg-[#E8D5A2] text-[#0A0A0A] font-semibold"
            size="sm"
          >
            <Plus className="size-3.5 me-1.5" />
            {t('newTask')}
          </Button>
        </div>
      )}

      {tasks.length === 0 ? (
        <div className="flex flex-col items-center justify-center text-center py-14 px-4 rounded-xl border border-dashed border-neutral-200 bg-white">
          <span
            aria-hidden="true"
            className="size-14 rounded-full bg-[#C9A961]/15 flex items-center justify-center mb-4"
          >
            <ClipboardList className="size-7 text-[#A88840]" />
          </span>
          <p className="text-sm text-neutral-600 mb-4">{t(emptyKey)}</p>
          {!hideCreateButton && (
            <Button
              type="button"
              onClick={() => setDialogState({ mode: 'create' })}
              variant="outline"
              size="sm"
            >
              <Plus className="size-3.5 me-1.5" />
              {t('createFirst')}
            </Button>
          )}
        </div>
      ) : compact ? (
        <div className="rounded-xl border border-neutral-200 bg-white divide-y divide-neutral-100 overflow-hidden shadow-sm">
          {tasks.map(renderRow)}
        </div>
      ) : (
        <div className="space-y-4">
          {groups.map((group) => (
            <section key={group.status}>
              <div className="flex items-center gap-2 px-1 mb-1.5">
                <span
                  aria-hidden="true"
                  className="size-2.5 rounded-full shrink-0"
                  style={{ background: STATUS_COLOR[group.status] }}
                />
                <h3 className="text-sm font-semibold text-neutral-700">{ts(group.status)}</h3>
                <span className="text-xs font-medium text-neutral-600 tabular-nums">
                  {group.items.length}
                </span>
              </div>
              <div className="rounded-xl border border-neutral-200 bg-white divide-y divide-neutral-100 overflow-hidden shadow-sm">
                {group.items.map(renderRow)}
              </div>
            </section>
          ))}
        </div>
      )}

      {dialogState && (
        <TaskFormDialog
          open
          onOpenChange={(o) => !o && setDialogState(null)}
          mode={dialogState.mode}
          task={dialogState.mode === 'edit' ? dialogState.task : null}
          presetCaseId={presetCaseId}
          assignees={assignees}
          cases={cases}
        />
      )}
    </div>
  );
}
