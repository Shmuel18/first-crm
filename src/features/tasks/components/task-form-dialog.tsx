'use client';

import { useActionState, useEffect } from 'react';
import { useFormStatus } from 'react-dom';

import { Loader2 } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { DateInputWithPicker } from '@/components/ui/date-input-with-picker';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { FormField, NativeSelect } from '@/components/shared/form-fields';
import { fieldDefault } from '@/lib/utils/form-defaults';

import { createTaskAction } from '../actions/create-task';
import { updateTaskAction } from '../actions/update-task';
import { TaskTagPicker } from './task-tag-picker';
import {
  TASK_ACTION_INITIAL,
  TASK_PRIORITY_VALUES,
  type TaskActionState,
  type TaskWithRelations,
} from '../types';

type Profile = { id: string; first_name: string | null; last_name: string | null };
type CaseOption = { id: string; case_number: string; label: string };

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: 'create' | 'edit';
  task?: TaskWithRelations | null;
  presetCaseId?: string | null;
  assignees: ReadonlyArray<Profile>;
  cases: ReadonlyArray<CaseOption>;
};

export function TaskFormDialog({
  open,
  onOpenChange,
  mode,
  task,
  presetCaseId,
  assignees,
  cases,
}: Props) {
  const t = useTranslations('tasks.form');
  const tc = useTranslations('common');
  const tp = useTranslations('tasks.priority');
  const tt = useTranslations('tasks.tags');

  const action = mode === 'create' ? createTaskAction : updateTaskAction;
  const [state, formAction] = useActionState<TaskActionState, FormData>(
    action,
    TASK_ACTION_INITIAL,
  );

  useEffect(() => {
    if (state.ok === true) onOpenChange(false);
  }, [state, onOpenChange]);

  const fieldErrors =
    state.ok === false && state.error === 'validation' ? state.fieldErrors ?? {} : {};
  const submitted =
    state.ok === false && state.error !== 'idle' ? state.values : undefined;

  const initialRecord = (task ?? null) as Record<string, unknown> | null;
  const value = (name: string) => fieldDefault(name, submitted, initialRecord);

  const presetCase = presetCaseId ?? task?.case_id ?? '';
  const genericError = getGenericError(state, t);

  // The option lists are bounded (newest 200 cases, active profiles only). In
  // edit mode, make sure the task's current case/assignee is always selectable
  // so a routine save doesn't silently null out a value missing from the list.
  const currentAssignee = task?.assignee ?? null;
  const effectiveAssignees =
    currentAssignee && !assignees.some((a) => a.id === currentAssignee.id)
      ? [currentAssignee, ...assignees]
      : assignees;

  const currentCase = task?.case ?? null;
  const effectiveCases =
    currentCase && !cases.some((c) => c.id === currentCase.id)
      ? [
          {
            id: currentCase.id,
            case_number: currentCase.case_number,
            label: `#${currentCase.case_number}`,
          },
          ...cases,
        ]
      : cases;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>
            {mode === 'create' ? t('title.create') : t('title.edit')}
          </DialogTitle>
        </DialogHeader>

        <form action={formAction} className="space-y-4" noValidate>
          {mode === 'edit' && task && (
            <input type="hidden" name="task_id" value={task.id} />
          )}

          <FormField label={t('fields.title')} required error={fieldErrors.title}>
            <Input
              name="title"
              defaultValue={value('title')}
              placeholder={t('fields.titlePlaceholder')}
              autoFocus
              maxLength={240}
            />
          </FormField>

          <FormField label={t('fields.description')} error={fieldErrors.description}>
            <Textarea
              name="description"
              defaultValue={value('description')}
              placeholder={t('fields.descriptionPlaceholder')}
              rows={3}
              maxLength={2000}
            />
          </FormField>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField label={t('fields.priority')} error={fieldErrors.priority}>
              <NativeSelect name="priority" defaultValue={value('priority') || 'normal'}>
                {TASK_PRIORITY_VALUES.map((p) => (
                  <option key={p} value={p}>{tp(p)}</option>
                ))}
              </NativeSelect>
            </FormField>

            <FormField label={t('fields.dueDate')} error={fieldErrors.due_date}>
              <DateInputWithPicker
                name="due_date"
                defaultValue={value('due_date').slice(0, 10)}
                pickerLabel={t('fields.dueDate')}
              />
            </FormField>
          </div>

          <FormField label={tt('label')}>
            <TaskTagPicker defaultTags={task?.tags ?? []} />
          </FormField>

          <FormField label={t('fields.assignee')} error={fieldErrors.assigned_to}>
            <NativeSelect name="assigned_to" defaultValue={value('assigned_to')}>
              <option value="">{t('fields.assigneeUnassigned')}</option>
              {effectiveAssignees.map((p) => {
                const name = [p.first_name, p.last_name].filter(Boolean).join(' ') || tc('noName');
                return <option key={p.id} value={p.id}>{name}</option>;
              })}
            </NativeSelect>
          </FormField>

          <FormField label={t('fields.case')} error={fieldErrors.case_id}>
            {/* A disabled <select> is omitted from FormData, so when the case is
                preset (locked) we submit it via a hidden input and leave the
                visible select purely presentational (no name). */}
            {presetCaseId && <input type="hidden" name="case_id" value={presetCaseId} />}
            <NativeSelect
              name={presetCaseId ? undefined : 'case_id'}
              defaultValue={presetCase || value('case_id')}
              disabled={!!presetCaseId}
            >
              <option value="">{t('fields.caseNone')}</option>
              {effectiveCases.map((c) => (
                <option key={c.id} value={c.id}>{c.label}</option>
              ))}
            </NativeSelect>
          </FormField>

          {genericError && (
            <div className="rounded-md bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">
              {genericError}
            </div>
          )}

          <DialogFooter>
            <SubmitButton mode={mode} />
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              {tc('cancel')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function SubmitButton({ mode }: { mode: 'create' | 'edit' }) {
  const { pending } = useFormStatus();
  const t = useTranslations('tasks.form.submit');
  return (
    <Button type="submit" disabled={pending} className="bg-brand-gold hover:bg-brand-gold-hover text-brand-black font-semibold">
      {pending ? <Loader2 className="size-4 animate-spin" /> : mode === 'create' ? t('create') : t('update')}
    </Button>
  );
}

function getGenericError(
  state: TaskActionState,
  t: ReturnType<typeof useTranslations>,
): string | null {
  if (state.ok !== false) return null;
  if (state.error === 'idle' || state.error === 'validation') return null;
  if (state.error === 'unauthorized') return t('errors.unauthorized');
  if (state.error === 'not_found') return t('errors.notFound');
  return t('errors.generic');
}
