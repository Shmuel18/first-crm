'use client';

import { useActionState, useEffect, useMemo, useState } from 'react';
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
import { formatPersonName } from '@/lib/utils/person-name';

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
  const [isPrivate, setIsPrivate] = useState<boolean>(Boolean(task?.is_private));

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
  const effectiveCases = useMemo(
    () =>
      currentCase && !cases.some((c) => c.id === currentCase.id)
        ? [
            {
              id: currentCase.id,
              case_number: currentCase.case_number,
              label: `#${currentCase.case_number}`,
            },
            ...cases,
          ]
        : cases,
    [cases, currentCase],
  );
  const selectedCaseId = presetCase || value('case_id');
  const resetKey = `${mode}:${task?.id ?? 'new'}:${selectedCaseId}`;
  const [casePicker, setCasePicker] = useState({
    resetKey,
    search: '',
    caseId: selectedCaseId,
  });
  const caseSearch = casePicker.resetKey === resetKey ? casePicker.search : '';
  const chosenCaseId = casePicker.resetKey === resetKey ? casePicker.caseId : selectedCaseId;
  const updateCasePicker = (patch: { search?: string; caseId?: string }) => {
    setCasePicker((prev) => ({
      resetKey,
      search: patch.search ?? (prev.resetKey === resetKey ? prev.search : ''),
      caseId: patch.caseId ?? (prev.resetKey === resetKey ? prev.caseId : selectedCaseId),
    }));
  };

  const selectedCase = effectiveCases.find((c) => c.id === chosenCaseId);
  const filteredCases = useMemo(
    () => filterCaseOptions(effectiveCases, caseSearch, selectedCase),
    [caseSearch, effectiveCases, selectedCase],
  );

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

          <label className="flex items-start gap-2 rounded-lg border border-neutral-200 bg-brand-gold-soft/40 p-3 text-sm">
            <input
              type="checkbox"
              name="is_private"
              checked={isPrivate}
              onChange={(e) => setIsPrivate(e.target.checked)}
              className="mt-0.5 size-4 rounded border-neutral-300 text-brand-gold-text focus:ring-2 focus:ring-brand-gold-text/40"
            />
            <span>
              <span className="font-medium text-neutral-800">{t('fields.private')}</span>
              <span className="mt-0.5 block text-xs text-neutral-500">{t('fields.privateHint')}</span>
            </span>
          </label>

          <FormField label={t('fields.assignee')} error={fieldErrors.assigned_to}>
            <NativeSelect name="assigned_to" defaultValue={value('assigned_to')} disabled={isPrivate}>
              <option value="">{t('fields.assigneeUnassigned')}</option>
              {effectiveAssignees.map((p) => {
                const name = formatPersonName(p.first_name, p.last_name) || tc('noName');
                return <option key={p.id} value={p.id}>{name}</option>;
              })}
            </NativeSelect>
            {isPrivate && <p className="mt-1 text-xs text-neutral-500">{t('fields.privateAssignee')}</p>}
          </FormField>

          <FormField label={t('fields.case')} error={fieldErrors.case_id}>
            {/* A disabled <select> is omitted from FormData, so when the case is
                preset (locked) we submit it via a hidden input and leave the
                visible select purely presentational (no name). */}
            {presetCaseId && <input type="hidden" name="case_id" value={presetCaseId} />}
            {presetCaseId ? (
              <Input
                value={selectedCase?.label ?? ''}
                disabled
                aria-label={t('fields.case')}
              />
            ) : (
              <CaseTypeahead
                cases={filteredCases}
                selectedCase={selectedCase}
                search={caseSearch}
                onSearchChange={(search) => updateCasePicker({ search })}
                onSelect={(nextCase) => {
                  updateCasePicker({ caseId: nextCase.id, search: '' });
                }}
                onClear={() => {
                  updateCasePicker({ caseId: '', search: '' });
                }}
                labels={{
                  search: t('fields.caseSearch'),
                  placeholder: t('fields.caseSearchPlaceholder'),
                  none: t('fields.caseNone'),
                  noMatches: t('fields.caseNoMatches'),
                  clear: tc('clear'),
                }}
              />
            )}
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

function filterCaseOptions(
  cases: ReadonlyArray<CaseOption>,
  query: string,
  selectedCase: CaseOption | undefined,
): CaseOption[] {
  const normalized = query.trim().toLowerCase();
  const matches = normalized
    ? cases.filter((c) => `${c.case_number} ${c.label}`.toLowerCase().includes(normalized))
    : cases;
  const visible = matches.slice(0, 8);
  if (selectedCase && !visible.some((c) => c.id === selectedCase.id)) {
    return [selectedCase, ...visible].slice(0, 8);
  }
  return visible;
}

function CaseTypeahead({
  cases,
  selectedCase,
  search,
  onSearchChange,
  onSelect,
  onClear,
  labels,
}: {
  cases: ReadonlyArray<CaseOption>;
  selectedCase: CaseOption | undefined;
  search: string;
  onSearchChange: (value: string) => void;
  onSelect: (option: CaseOption) => void;
  onClear: () => void;
  labels: {
    search: string;
    placeholder: string;
    none: string;
    noMatches: string;
    clear: string;
  };
}) {
  return (
    <div className="space-y-2">
      <input type="hidden" name="case_id" value={selectedCase?.id ?? ''} />
      <div className="rounded-lg border border-neutral-200 bg-white p-2">
        <Input
          type="search"
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder={selectedCase ? selectedCase.label : labels.placeholder}
          aria-label={labels.search}
          autoComplete="off"
        />
        <div className="mt-2 max-h-56 overflow-y-auto rounded-md border border-neutral-100 bg-neutral-50/60 p-1">
          {cases.length === 0 ? (
            <p className="px-2 py-2 text-xs text-neutral-500">{labels.noMatches}</p>
          ) : (
            <div role="listbox" aria-label={labels.search} className="space-y-1">
              {cases.map((c) => {
                const selected = c.id === selectedCase?.id;
                return (
                  <button
                    key={c.id}
                    type="button"
                    role="option"
                    aria-selected={selected}
                    onClick={() => onSelect(c)}
                    className={`flex w-full items-center justify-between gap-3 rounded-md px-2.5 py-2 text-start text-sm transition ${
                      selected
                        ? 'bg-brand-gold/15 font-semibold text-brand-black'
                        : 'text-neutral-700 hover:bg-white hover:text-neutral-950'
                    }`}
                  >
                    <span className="min-w-0 truncate">{c.label}</span>
                    <span className="shrink-0 text-xs text-neutral-400" dir="ltr">
                      #{c.case_number}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
      <div className="flex items-center justify-between gap-3 text-xs">
        <span className="min-w-0 truncate text-neutral-500">
          {selectedCase ? selectedCase.label : labels.none}
        </span>
        {selectedCase && (
          <button
            type="button"
            onClick={onClear}
            className="shrink-0 font-medium text-brand-gold-text transition hover:text-brand-black"
          >
            {labels.clear}
          </button>
        )}
      </div>
    </div>
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
