'use client';

import { useState } from 'react';

import { FileText, Upload as UploadIcon, X } from 'lucide-react';
import { useTranslations } from 'next-intl';

type Props = {
  files: ReadonlyArray<File>;
  /** Raw files the user picked or dropped — the parent validates and merges. */
  onAdd: (files: File[]) => void;
  onRemove: (index: number) => void;
  /** Error key per file name, for files whose upload failed in this batch. */
  failedNames: ReadonlyMap<string, string>;
  errorText: (key: string) => string;
  disabled: boolean;
};

/**
 * Drop zone + chosen-files list for the upload modal. Several files at once,
 * by drag-and-drop or the picker (like Drive). Rendering + event delegation
 * only: validation and the upload itself live in the modal / useMultiUpload.
 */
export function UploadFilePicker({ files, onAdd, onRemove, failedNames, errorText, disabled }: Props) {
  const t = useTranslations('documents.uploadModal');
  const [isDragOver, setIsDragOver] = useState(false);

  return (
    <div className="space-y-2">
      <label
        htmlFor="file-input"
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragOver(true);
        }}
        onDragLeave={() => setIsDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setIsDragOver(false);
          if (!disabled) onAdd(Array.from(e.dataTransfer.files ?? []));
        }}
        className={`flex min-h-24 cursor-pointer flex-col items-center justify-center gap-1.5 rounded-md border border-dashed px-3 py-4 text-center text-sm transition focus-within:border-brand-gold-text focus-within:ring-2 focus-within:ring-brand-gold-text/30 ${
          isDragOver
            ? 'border-brand-gold-text bg-brand-gold/15 text-brand-gold-text'
            : 'border-neutral-300 bg-neutral-50 text-neutral-700 hover:border-brand-gold-text hover:bg-brand-gold/8'
        }`}
      >
        <UploadIcon className="size-5 shrink-0" aria-hidden="true" />
        <span>{t('filePlaceholder')}</span>
      </label>
      <input
        id="file-input"
        name="file"
        type="file"
        multiple
        disabled={disabled}
        accept=".pdf,.jpg,.jpeg,.png,.webp,.heic,.heif,.doc,.docx,.xls,.xlsx"
        className="sr-only"
        onChange={(e) => {
          onAdd(Array.from(e.target.files ?? []));
          // Reset so picking the same file again (after removing it) still fires.
          e.target.value = '';
        }}
      />

      {files.length > 0 && (
        <ul className="max-h-48 divide-y divide-neutral-100 overflow-y-auto rounded-md border border-neutral-200">
          {files.map((file, index) => {
            const failed = failedNames.get(file.name);
            return (
              <li key={`${file.name}-${index}`} className="flex items-center gap-2 px-3 py-1.5 text-sm">
                <FileText className="size-4 shrink-0 text-neutral-400" aria-hidden="true" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-neutral-800">{file.name}</span>
                  {failed && <span className="block text-xs text-rose-600">{errorText(failed)}</span>}
                </span>
                <button
                  type="button"
                  onClick={() => onRemove(index)}
                  disabled={disabled}
                  aria-label={t('removeFile', { name: file.name })}
                  className="flex size-7 shrink-0 items-center justify-center rounded-md text-neutral-400 transition hover:bg-rose-50 hover:text-rose-600 disabled:opacity-40"
                >
                  <X className="size-4" aria-hidden="true" />
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
