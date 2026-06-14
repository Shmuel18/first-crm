'use client';

import { useActionState, useCallback, useEffect, useRef, useState } from 'react';
import { useFormStatus } from 'react-dom';

import { Loader2, Upload as UploadIcon, X } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { Button } from '@/components/ui/button';
import { ALLOWED_MIME_TYPES, MAX_FILE_SIZE_BYTES } from '@/features/documents/schemas/document.schema';
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
import {
  TASK_ACTION_INITIAL,
  TASK_PRIORITY_VALUES,
  type TaskActionState,
  type TaskWithRelations,
} from '../types';
import { TaskAssignmentHistory } from './task-assignment-history';
import { TaskAttachmentsList } from './task-attachments-list';
import { runTaskAttachmentUploads } from './upload-task-attachments';

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

  const action = mode === 'create' ? createTaskAction : updateTaskAction;
  const [state, formAction] = useActionState<TaskActionState, FormData>(
    action,
    TASK_ACTION_INITIAL,
  );

  const fieldErrors =
    state.ok === false && state.error === 'validation' ? state.fieldErrors ?? {} : {};
  const submitted =
    state.ok === false && state.error !== 'idle' ? state.values : undefined;

  const initialRecord = (task ?? null) as Record<string, unknown> | null;
  const value = (name: string) => fieldDefault(name, submitted, initialRecord);
  const [isPrivate, setIsPrivate] = useState<boolean>(Boolean(task?.is_private));
  const [selectedCaseId, setSelectedCaseId] = useState<string>(presetCaseId ?? task?.case_id ?? '');
  const [attachments, setAttachments] = useState<File[]>([]);
  const [attachmentError, setAttachmentError] = useState<string | null>(null);
  const [attachmentPending, setAttachmentPending] = useState(false);
  const handledSuccessRef = useRef<TaskActionState | null>(null);

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
  const resetAttachmentState = useCallback((): void => {
    setSelectedCaseId(presetCaseId ?? task?.case_id ?? '');
    setAttachments([]);
    setAttachmentError(null);
    setAttachmentPending(false);
  }, [presetCaseId, task?.case_id]);

  const handleDialogOpenChange = useCallback((nextOpen: boolean): void => {
    if (!nextOpen) resetAttachmentState();
    onOpenChange(nextOpen);
  }, [onOpenChange, resetAttachmentState]);

  useEffect(() => {
    if (state.ok !== true) return;
    if (handledSuccessRef.current === state) return;
    handledSuccessRef.current = state;

    if (mode !== 'create' || attachments.length === 0) {
      queueMicrotask(() => handleDialogOpenChange(false));
      return;
    }

    let cancelled = false;
    queueMicrotask(() => {
      if (!cancelled) {
        setAttachmentPending(true);
        setAttachmentError(null);
      }
    });

    void (async () => {
      await runTaskAttachmentUploads(state.taskId, selectedCaseId || null, attachments);
      if (!cancelled) handleDialogOpenChange(false);
    })().catch((err) => {
      if (!cancelled) setAttachmentError(mapAttachmentError(err, t));
    }).finally(() => {
      if (!cancelled) setAttachmentPending(false);
    });

    return () => {
      cancelled = true;
    };
  }, [attachments, handleDialogOpenChange, mode, selectedCaseId, state, t]);

  const [caseSearch, setCaseSearch] = useState('');

  // tasks-list / tasks-board render ONE shared TaskFormDialog and swap the `task`
  // prop; the create button reuses one instance across clicks. These controlled
  // fields live in this always-mounted component, so — unlike the uncontrolled
  // defaultValue fields, which re-seed when the Base UI popup remounts on open —
  // they would otherwise keep the PREVIOUS task's value, e.g. the linked-case
  // field showing a case from a task opened earlier (reported bug). Re-seed from
  // the current task whenever the dialog opens or the target task changes. React
  // "adjust state during render when a prop changes" pattern (cf. compose-email-dialog).
  const seedKey = open ? `${task?.id ?? 'new'}:${presetCaseId ?? ''}` : null;
  const [seededKey, setSeededKey] = useState(seedKey);
  if (seedKey !== seededKey) {
    setSeededKey(seedKey);
    if (open) {
      setSelectedCaseId(presetCaseId ?? task?.case_id ?? '');
      setIsPrivate(Boolean(task?.is_private));
      setCaseSearch('');
      setAttachments([]);
      setAttachmentError(null);
    }
  }

  const normalizedCaseSearch = caseSearch.trim().toLowerCase();
  const matchingCases = normalizedCaseSearch
    ? effectiveCases.filter((c) =>
        `${c.case_number} ${c.label}`.toLowerCase().includes(normalizedCaseSearch),
      )
    : effectiveCases;
  const selectedCase = effectiveCases.find((c) => c.id === selectedCaseId);
  const filteredCases =
    selectedCase && !matchingCases.some((c) => c.id === selectedCase.id)
      ? [selectedCase, ...matchingCases]
      : matchingCases;

  return (
    <Dialog open={open} onOpenChange={handleDialogOpenChange}>
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

          {mode === 'edit' && task && <TaskAssignmentHistory task={task} />}

          <FormField label={t('fields.case')} error={fieldErrors.case_id}>
            {/* A disabled <select> is omitted from FormData, so when the case is
                preset (locked) we submit it via a hidden input and leave the
                visible select purely presentational (no name). */}
            {presetCaseId && <input type="hidden" name="case_id" value={presetCaseId} />}
            {!presetCaseId && (
              <Input
                type="search"
                value={caseSearch}
                onChange={(e) => setCaseSearch(e.target.value)}
                placeholder={t('fields.caseSearchPlaceholder')}
                aria-label={t('fields.caseSearch')}
                className="mb-2"
              />
            )}
            <NativeSelect
              name={presetCaseId ? undefined : 'case_id'}
              value={selectedCaseId}
              onChange={(e) => setSelectedCaseId(e.target.value)}
              disabled={!!presetCaseId}
            >
              <option value="">{t('fields.caseNone')}</option>
              {filteredCases.map((c) => (
                <option key={c.id} value={c.id}>{c.label}</option>
              ))}
            </NativeSelect>
            {!presetCaseId && filteredCases.length === 0 && (
              <p className="mt-1 text-xs text-neutral-500">{t('fields.caseNoMatches')}</p>
            )}
          </FormField>

          {mode === 'edit' && task && <TaskAttachmentsList taskId={task.id} />}

          {mode === 'create' && (
            <FormField
              label={t('fields.attachments')}
              error={attachmentError ?? undefined}
            >
              <div className="flex items-center gap-2">
                <label
                  htmlFor="task-attachments"
                  className="flex h-10 flex-1 cursor-pointer items-center gap-2 rounded-md border border-dashed border-neutral-300 bg-neutral-50 px-3 text-sm text-neutral-700 transition hover:border-brand-gold-text hover:bg-brand-gold/8 focus-within:border-brand-gold-text focus-within:ring-2 focus-within:ring-brand-gold-text/30"
                >
                  <UploadIcon className="size-4 shrink-0" />
                  <span className="truncate">
                    {attachments.length > 0
                      ? t('fields.attachmentsSelected', { count: attachments.length })
                      : t('fields.attachmentsPlaceholder')}
                  </span>
                </label>
                {attachments.length > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      setAttachments([]);
                      setAttachmentError(null);
                    }}
                    className="flex size-9 items-center justify-center rounded-md border border-neutral-200 text-neutral-500 transition hover:border-rose-200 hover:text-rose-600"
                    aria-label={t('fields.attachmentsClear')}
                    disabled={attachmentPending}
                  >
                    <X className="size-4" />
                  </button>
                )}
              </div>
              <input
                id="task-attachments"
                type="file"
                multiple
                accept=".pdf,.jpg,.jpeg,.png,.webp,.heic,.heif,.doc,.docx,.xls,.xlsx"
                className="sr-only"
                onChange={(e) => {
                  setAttachmentError(null);
                  const files = Array.from(e.target.files ?? []);
                  const err = validateAttachmentFiles(files, t);
                  if (err) {
                    setAttachmentError(err);
                    e.target.value = '';
                    setAttachments([]);
                    return;
                  }
                  setAttachments(files);
                }}
              />
              <p className="mt-1 text-xs text-neutral-500">
                {selectedCaseId
                  ? t('fields.attachmentsHint')
                  : t('fields.attachmentsHintGeneral')}
              </p>
            </FormField>
          )}

          {(genericError || attachmentPending) && (
            <div className="rounded-md bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">
              {attachmentPending ? t('fields.attachmentsUploading') : genericError}
            </div>
          )}

          <DialogFooter>
            <SubmitButton mode={mode} uploading={attachmentPending} />
            <Button
              type="button"
              variant="outline"
              onClick={() => handleDialogOpenChange(false)}
            >
              {tc('cancel')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function SubmitButton({
  mode,
  uploading,
}: {
  mode: 'create' | 'edit';
  uploading: boolean;
}) {
  const { pending } = useFormStatus();
  const t = useTranslations('tasks.form.submit');
  return (
    <Button type="submit" disabled={pending || uploading} className="bg-brand-gold hover:bg-brand-gold-hover text-brand-black font-semibold">
      {pending || uploading ? <Loader2 className="size-4 animate-spin" /> : mode === 'create' ? t('create') : t('update')}
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

function validateAttachmentFiles(
  files: File[],
  t: ReturnType<typeof useTranslations>,
): string | null {
  if (files.length === 0) return null;
  if (files.length > 5) return t('fields.attachmentsTooMany');
  for (const file of files) {
    if (file.size === 0) return t('fields.attachmentsFileRequired');
    if (file.size > MAX_FILE_SIZE_BYTES) return t('fields.attachmentsTooLarge');
    if (!(ALLOWED_MIME_TYPES as readonly string[]).includes(file.type)) {
      return t('fields.attachmentsTypeNotAllowed');
    }
  }
  return null;
}

function mapAttachmentError(
  err: unknown,
  t: ReturnType<typeof useTranslations>,
): string {
  const message = err instanceof Error ? err.message : '';
  if (message === 'fileRequired') return t('fields.attachmentsFileRequired');
  if (message === 'fileTooLarge') return t('fields.attachmentsTooLarge');
  if (message === 'fileTypeNotAllowed') return t('fields.attachmentsTypeNotAllowed');
  return t('fields.attachmentsFailed');
}
