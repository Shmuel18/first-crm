'use client';

import { Upload as UploadIcon, X } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { FormField } from '@/components/shared/form-fields';
import { ALLOWED_MIME_TYPES, MAX_FILE_SIZE_BYTES } from '@/features/documents/schemas/document.schema';

type Props = {
  attachments: File[];
  onAttachmentsChange: (files: File[]) => void;
  error: string | null;
  onError: (msg: string | null) => void;
  pending: boolean;
  hasCaseLinked: boolean;
};

/** Create-mode file picker (multiple, validated client-side before upload). */
export function TaskAttachmentUploadField({
  attachments,
  onAttachmentsChange,
  error,
  onError,
  pending,
  hasCaseLinked,
}: Props) {
  const t = useTranslations('tasks.form.fields');
  return (
    <FormField label={t('attachments')} error={error ?? undefined}>
      <div className="flex items-center gap-2">
        <label
          htmlFor="task-attachments"
          className="flex h-10 flex-1 cursor-pointer items-center gap-2 rounded-md border border-dashed border-neutral-300 bg-neutral-50 px-3 text-sm text-neutral-700 transition hover:border-brand-gold-text hover:bg-brand-gold/8 focus-within:border-brand-gold-text focus-within:ring-2 focus-within:ring-brand-gold-text/30"
        >
          <UploadIcon className="size-4 shrink-0" aria-hidden="true" />
          <span className="min-w-0 truncate">
            {attachments.length > 0
              ? t('attachmentsSelected', { count: attachments.length })
              : t('attachmentsPlaceholder')}
          </span>
        </label>
        {attachments.length > 0 && (
          <button
            type="button"
            onClick={() => {
              onAttachmentsChange([]);
              onError(null);
            }}
            className="flex size-9 items-center justify-center rounded-md border border-neutral-200 text-neutral-500 transition hover:border-rose-200 hover:text-rose-600"
            aria-label={t('attachmentsClear')}
            disabled={pending}
          >
            <X className="size-4" aria-hidden="true" />
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
          onError(null);
          const files = Array.from(e.target.files ?? []);
          const err = validateAttachmentFiles(files, t);
          if (err) {
            onError(err);
            e.target.value = '';
            onAttachmentsChange([]);
            return;
          }
          onAttachmentsChange(files);
        }}
      />
      <p className="mt-1 text-xs text-neutral-500">
        {hasCaseLinked ? t('attachmentsHint') : t('attachmentsHintGeneral')}
      </p>
    </FormField>
  );
}

function validateAttachmentFiles(
  files: File[],
  t: ReturnType<typeof useTranslations>,
): string | null {
  if (files.length === 0) return null;
  if (files.length > 5) return t('attachmentsTooMany');
  for (const file of files) {
    if (file.size === 0) return t('attachmentsFileRequired');
    if (file.size > MAX_FILE_SIZE_BYTES) return t('attachmentsTooLarge');
    if (!(ALLOWED_MIME_TYPES as readonly string[]).includes(file.type)) {
      return t('attachmentsTypeNotAllowed');
    }
  }
  return null;
}
