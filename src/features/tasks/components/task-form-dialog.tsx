'use client';

import { useActionState, useCallback, useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { useFormStatus } from 'react-dom';

import { Loader2, Pencil } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { FormField, NativeSelect } from '@/components/shared/form-fields';
import { Linkify } from '@/components/shared/linkify';
import { Button } from '@/components/ui/button';
import { DateInputWithPicker } from '@/components/ui/date-input-with-picker';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { fieldDefault } from '@/lib/utils/form-defaults';
import { formatPersonName } from '@/lib/utils/person-name';

import { createTaskAction } from '../actions/create-task';
import { updateTaskAction } from '../actions/update-task';
import {
  TASK_ACTION_INITIAL,
  type TaskActionState,
  type TaskPriority,
  type TaskWithRelations,
} from '../types';
import { TaskAssignmentHistory } from './task-assignment-history';
import { TaskAttachmentsList } from './task-attachments-list';
import { TaskAttachmentUploadField } from './task-attachment-upload-field';
import { TaskLinkedCaseField } from './task-linked-case-field';
import { TaskPriorityField } from './task-priority-field';
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

  const action = mode === 'create' ? createTaskAction : updateTaskAction;
  const [state, formAction] = useActionState<TaskActionState, FormData>(action, TASK_ACTION_INITIAL);

  const fieldErrors =
    state.ok === false && state.error === 'validation' ? state.fieldErrors ?? {} : {};
  const submitted = state.ok === false && state.error !== 'idle' ? state.values : undefined;

  const initialRecord = (task ?? null) as Record<string, unknown> | null;
  const value = (name: string) => fieldDefault(name, submitted, initialRecord);
  const [isPrivate, setIsPrivate] = useState<boolean>(Boolean(task?.is_private));
  const [selectedCaseId, setSelectedCaseId] = useState<string>(presetCaseId ?? task?.case_id ?? '');
  const [attachments, setAttachments] = useState<File[]>([]);
  const [attachmentError, setAttachmentError] = useState<string | null>(null);
  const [attachmentPending, setAttachmentPending] = useState(false);
  // Description is controlled so it can render as clickable links (view) or an
  // editable textarea (edit) while always submitting via a hidden input.
  const [description, setDescription] = useState<string>(value('description'));
  const [editingDesc, setEditingDesc] = useState<boolean>(!value('description'));
  const handledSuccessRef = useRef<TaskActionState | null>(null);

  const genericError = getGenericError(state, t);

  // Make sure the task's current assignee is always selectable even if it's not
  // in the bounded option list, so a routine save doesn't null it out.
  const currentAssignee = task?.assignee ?? null;
  const effectiveAssignees =
    currentAssignee && !assignees.some((a) => a.id === currentAssignee.id)
      ? [currentAssignee, ...assignees]
      : assignees;

  const resetAttachmentState = useCallback((): void => {
    setSelectedCaseId(presetCaseId ?? task?.case_id ?? '');
    setAttachments([]);
    setAttachmentError(null);
    setAttachmentPending(false);
  }, [presetCaseId, task?.case_id]);

  const handleDialogOpenChange = useCallback(
    (nextOpen: boolean): void => {
      if (!nextOpen) resetAttachmentState();
      onOpenChange(nextOpen);
    },
    [onOpenChange, resetAttachmentState],
  );

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
    })()
      .catch((err) => {
        if (!cancelled) setAttachmentError(mapAttachmentError(err, t));
      })
      .finally(() => {
        if (!cancelled) setAttachmentPending(false);
      });

    return () => {
      cancelled = true;
    };
  }, [attachments, handleDialogOpenChange, mode, selectedCaseId, state, t]);

  // One shared TaskFormDialog instance is reused across rows; its controlled
  // fields would otherwise keep the previous task's values. Re-seed from the
  // current task whenever the dialog opens or the target task changes.
  const seedKey = open ? `${task?.id ?? 'new'}:${presetCaseId ?? ''}` : null;
  const [seededKey, setSeededKey] = useState(seedKey);
  if (seedKey !== seededKey) {
    setSeededKey(seedKey);
    if (open) {
      setSelectedCaseId(presetCaseId ?? task?.case_id ?? '');
      setIsPrivate(Boolean(task?.is_private));
      setAttachments([]);
      setAttachmentError(null);
      const seededDesc = value('description');
      setDescription(seededDesc);
      setEditingDesc(!seededDesc);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleDialogOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>{mode === 'create' ? t('title.create') : t('title.edit')}</DialogTitle>
          <DialogDescription>{t('subtitle')}</DialogDescription>
        </DialogHeader>

        <form action={formAction} className="space-y-5" noValidate>
          {mode === 'edit' && task && <input type="hidden" name="task_id" value={task.id} />}

          <Section title={t('sections.details')}>
            <FormField label={t('fields.title')} required error={fieldErrors.title}>
              <Input
                name="title"
                defaultValue={value('title')}
                placeholder={t('fields.titlePlaceholder')}
                autoFocus
                maxLength={240}
              />
            </FormField>

            <FormField label={t('fields.description')} error={fieldErrors.description} htmlFor="task-description">
              {/* Hidden input always carries the value, so it submits in both
                  view (clickable links) and edit (textarea) modes. */}
              <input type="hidden" name="description" value={description} />
              {editingDesc ? (
                <Textarea
                  id="task-description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder={t('fields.descriptionPlaceholder')}
                  rows={3}
                  maxLength={2000}
                />
              ) : (
                <div
                  onClick={() => setEditingDesc(true)}
                  className="min-h-10 cursor-text rounded-md border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-800"
                >
                  <Linkify text={description} />
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setEditingDesc(true);
                    }}
                    className="mt-1.5 flex items-center gap-1.5 text-xs text-brand-gold-text hover:underline"
                  >
                    <Pencil className="size-3.5" aria-hidden="true" />
                    {t('fields.descriptionEdit')}
                  </button>
                </div>
              )}
            </FormField>
          </Section>

          <Section title={t('sections.schedule')}>
            <FormField label={t('fields.priority')} error={fieldErrors.priority}>
              {/* value() returns a string; priority is CHECK-constrained to TaskPriority. */}
              <TaskPriorityField name="priority" defaultValue={(value('priority') || 'normal') as TaskPriority} />
            </FormField>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <FormField label={t('fields.dueDate')} error={fieldErrors.due_date}>
                <DateInputWithPicker
                  name="due_date"
                  defaultValue={value('due_date').slice(0, 10)}
                  pickerLabel={t('fields.dueDate')}
                />
              </FormField>

              <FormField label={t('fields.assignee')} error={fieldErrors.assigned_to}>
                <NativeSelect name="assigned_to" defaultValue={value('assigned_to')} disabled={isPrivate}>
                  <option value="">{t('fields.assigneeUnassigned')}</option>
                  {effectiveAssignees.map((p) => {
                    const name = formatPersonName(p.first_name, p.last_name) || tc('noName');
                    return (
                      <option key={p.id} value={p.id}>
                        {name}
                      </option>
                    );
                  })}
                </NativeSelect>
              </FormField>
            </div>
            {isPrivate && <p className="text-xs text-neutral-500">{t('fields.privateAssignee')}</p>}

            <div>
              <label className="flex items-center gap-2 text-sm text-neutral-700">
                <input
                  type="checkbox"
                  name="is_private"
                  checked={isPrivate}
                  onChange={(e) => setIsPrivate(e.target.checked)}
                  className="size-4 rounded border-neutral-300 text-brand-gold-text focus:ring-2 focus:ring-brand-gold-text/40"
                />
                {t('fields.private')}
              </label>
              <p className="mt-1 ps-6 text-xs text-neutral-500">{t('fields.privateHint')}</p>
            </div>
          </Section>

          <Section title={t('sections.case')}>
            <TaskLinkedCaseField
              cases={cases}
              presetCaseId={presetCaseId}
              task={task}
              selectedCaseId={selectedCaseId}
              onSelectedCaseChange={setSelectedCaseId}
              error={fieldErrors.case_id}
            />
          </Section>

          {mode === 'edit' && task && <TaskAttachmentsList taskId={task.id} />}
          {mode === 'create' && (
            <TaskAttachmentUploadField
              attachments={attachments}
              onAttachmentsChange={setAttachments}
              error={attachmentError}
              onError={setAttachmentError}
              pending={attachmentPending}
              hasCaseLinked={Boolean(selectedCaseId)}
            />
          )}

          {mode === 'edit' && task && <TaskAssignmentHistory task={task} />}

          {(genericError || attachmentPending) && (
            <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {attachmentPending ? t('fields.attachmentsUploading') : genericError}
            </div>
          )}

          <DialogFooter>
            <SubmitButton mode={mode} uploading={attachmentPending} />
            <Button type="button" variant="outline" onClick={() => handleDialogOpenChange(false)}>
              {tc('cancel')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-3">
      <p className="text-xs font-medium text-neutral-500">{title}</p>
      {children}
    </section>
  );
}

function SubmitButton({ mode, uploading }: { mode: 'create' | 'edit'; uploading: boolean }) {
  const { pending } = useFormStatus();
  const t = useTranslations('tasks.form.submit');
  return (
    <Button
      type="submit"
      disabled={pending || uploading}
      className="bg-brand-gold hover:bg-brand-gold-hover text-brand-black font-semibold"
    >
      {pending || uploading ? (
        <Loader2 className="size-4 animate-spin" />
      ) : mode === 'create' ? (
        t('create')
      ) : (
        t('update')
      )}
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

function mapAttachmentError(err: unknown, t: ReturnType<typeof useTranslations>): string {
  const message = err instanceof Error ? err.message : '';
  if (message === 'fileRequired') return t('fields.attachmentsFileRequired');
  if (message === 'fileTooLarge') return t('fields.attachmentsTooLarge');
  if (message === 'fileTypeNotAllowed') return t('fields.attachmentsTypeNotAllowed');
  return t('fields.attachmentsFailed');
}
