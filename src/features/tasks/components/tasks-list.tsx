'use client';

import { useState } from 'react';

import { ClipboardList, Plus } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { Button } from '@/components/ui/button';
import type { Locale } from '@/lib/i18n/direction';

import { TaskFormDialog } from './task-form-dialog';
import { TaskRow } from './task-row';
import type { TaskWithRelations } from '../types';

type Profile = { id: string; first_name: string | null; last_name: string | null };
type CaseOption = { id: string; case_number: string; label: string };

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
  const [dialogState, setDialogState] = useState<
    | { mode: 'create' }
    | { mode: 'edit'; task: TaskWithRelations }
    | null
  >(null);

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
          <span className="size-14 rounded-full bg-[#C9A961]/10 flex items-center justify-center mb-4">
            <ClipboardList className="size-7 text-[#C9A961]" />
          </span>
          <p className="text-sm text-neutral-500 mb-4">{t(emptyKey)}</p>
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
      ) : (
        <div className="rounded-xl border border-neutral-200 bg-white divide-y divide-neutral-100 overflow-hidden shadow-sm">
          {tasks.map((task) => (
            <TaskRow
              key={task.id}
              task={task}
              locale={locale}
              compact={compact}
              onEdit={(t) => setDialogState({ mode: 'edit', task: t })}
            />
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
