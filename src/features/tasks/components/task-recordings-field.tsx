'use client';

import { useState } from 'react';

import { AudioLines, Loader2, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';

import { runTaskRecordingUploads } from './upload-task-recordings';
import { VoiceRecorderButton } from './voice-recorder-button';

/** Pending recordings on the CREATE form — collected in state, uploaded by the
 *  dialog after the task is created (same flow as file attachments). */
export function TaskRecordingsField({
  recordings,
  onAdd,
  onRemove,
  disabled,
  atLimit,
}: {
  recordings: File[];
  onAdd: (file: File) => void;
  onRemove: (index: number) => void;
  disabled?: boolean;
  atLimit: boolean;
}) {
  const t = useTranslations('tasks.form.fields');
  return (
    <div className="space-y-2">
      {!atLimit && <VoiceRecorderButton disabled={disabled} onRecordingReady={onAdd} />}
      {recordings.length > 0 && (
        <ul className="space-y-1">
          {recordings.map((file, index) => (
            <li
              key={`${file.name}-${index}`}
              className="flex items-center gap-2 rounded-md border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm"
            >
              <AudioLines className="size-4 shrink-0 text-brand-gold-text" aria-hidden="true" />
              <span className="flex-1 truncate text-neutral-800">{file.name}</span>
              <button
                type="button"
                onClick={() => onRemove(index)}
                disabled={disabled}
                aria-label={t('recordCancel')}
                className="flex size-7 items-center justify-center rounded-md text-neutral-500 transition hover:bg-white hover:text-rose-600 disabled:opacity-50"
              >
                <X className="size-4" aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** Recorder on the EDIT dialog — uploads immediately, then asks the list to
 *  reload. Owns its own upload-pending state so the attachments list can refresh. */
export function TaskEditRecorder({
  taskId,
  onUploaded,
}: {
  taskId: string;
  onUploaded: () => void;
}) {
  const t = useTranslations('tasks.form.fields');
  const [pending, setPending] = useState(false);

  const handleReady = (file: File): void => {
    setPending(true);
    void runTaskRecordingUploads(taskId, [file])
      .then(() => onUploaded())
      .catch(() => toast.error(t('attachmentsFailed')))
      .finally(() => setPending(false));
  };

  return (
    <div className="space-y-1.5">
      <VoiceRecorderButton disabled={pending} onRecordingReady={handleReady} />
      {pending && (
        <p className="flex items-center gap-1.5 text-xs text-neutral-500">
          <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
          {t('attachmentsUploading')}
        </p>
      )}
    </div>
  );
}
