'use client';

import { useEffect, useRef, useState } from 'react';
import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';

import { Loader2, Upload as UploadIcon, X } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { FormField, NativeSelect } from '@/components/shared/form-fields';

import { uploadDocumentAction } from '../actions/upload-document';
import { ALLOWED_MIME_TYPES, MAX_FILE_SIZE_BYTES } from '../schemas/document.schema';
import {
  DOCUMENT_ACTION_INITIAL,
  type DocumentActionState,
  type DocumentCategoryRow,
  type DriveFolder,
} from '../types';

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  caseId: string;
  categories: ReadonlyArray<DocumentCategoryRow>;
  borrowers: ReadonlyArray<{ id: string; firstName: string | null; lastName: string | null }>;
  defaultFolder?: DriveFolder | null;
};

function SubmitButton() {
  const { pending } = useFormStatus();
  const t = useTranslations('documents.uploadModal');
  return (
    <Button
      type="submit"
      disabled={pending}
      className="bg-brand-black hover:bg-neutral-800 text-white h-10 min-w-28"
    >
      {pending ? <Loader2 className="size-4 animate-spin" /> : t('submit')}
    </Button>
  );
}

export function UploadDocumentModal({
  open,
  onOpenChange,
  caseId,
  categories,
  borrowers,
  defaultFolder,
}: Props) {
  const t = useTranslations('documents.uploadModal');
  const tErr = useTranslations('documents.errors');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [clientFileError, setClientFileError] = useState<string | null>(null);

  // Mirror of the server-side guards so the user sees the error before a
  // 20 MB file uploads in full and gets rejected by the action.
  const validateFile = (file: File): string | null => {
    if (file.size === 0) return tErr('fileRequired');
    if (file.size > MAX_FILE_SIZE_BYTES) return tErr('fileTooLarge');
    if (!(ALLOWED_MIME_TYPES as readonly string[]).includes(file.type)) {
      return tErr('fileTypeNotAllowed');
    }
    return null;
  };

  const handleDrop = (e: React.DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    setIsDragOver(false);
    setClientFileError(null);
    const dropped = e.dataTransfer.files?.[0];
    if (!dropped || !fileInputRef.current) return;
    const err = validateFile(dropped);
    if (err) {
      setClientFileError(err);
      return;
    }
    // Programmatically set the file input via DataTransfer
    const dt = new DataTransfer();
    dt.items.add(dropped);
    fileInputRef.current.files = dt.files;
    setFileName(dropped.name);
  };

  const [state, formAction] = useActionState<DocumentActionState, FormData>(
    uploadDocumentAction,
    DOCUMENT_ACTION_INITIAL,
  );

  // On success, ask the parent to close. The parent should remount the
  // modal via `key={String(open)}` so all internal state (form values,
  // useActionState result, refs) resets cleanly without us needing to
  // call setState here - which would trigger react-hooks/set-state-in-effect.
  useEffect(() => {
    if (state.ok === true) onOpenChange(false);
  }, [state, onOpenChange]);

  const filteredCategories = defaultFolder
    ? categories.filter((c) => c.drive_folder === defaultFolder)
    : categories;

  const defaultCategoryId = filteredCategories[0]?.id ?? '';

  const fieldErrors =
    state.ok === false && state.error === 'validation' ? state.fieldErrors ?? {} : {};
  const genericError =
    state.ok === false && state.error !== 'idle' && state.error !== 'validation'
      ? state.message ?? tErr('uploadFailed')
      : state.ok === false && state.error === 'validation' && state.message
        ? state.message
        : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>{t('title')}</DialogTitle>
        </DialogHeader>

        <form action={formAction} className="space-y-4" noValidate>
          <input type="hidden" name="case_id" value={caseId} />

          <FormField label={t('fileLabel')} required error={clientFileError ?? undefined}>
            <div className="flex items-center gap-2">
              <label
                htmlFor="file-input"
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDragOver(true);
                }}
                onDragLeave={() => setIsDragOver(false)}
                onDrop={handleDrop}
                className={`flex-1 flex items-center gap-2 px-3 h-10 rounded-md border border-dashed transition cursor-pointer text-sm focus-within:border-brand-gold-text focus-within:ring-2 focus-within:ring-brand-gold-text/30 ${
                  isDragOver
                    ? 'border-brand-gold-text bg-brand-gold/15 text-brand-gold-text'
                    : 'border-neutral-300 bg-neutral-50 hover:border-brand-gold-text hover:bg-brand-gold/8 text-neutral-700'
                }`}
              >
                <UploadIcon className="size-4 shrink-0" />
                <span className="truncate">{fileName ?? t('filePlaceholder')}</span>
              </label>
              {fileName && (
                <button
                  type="button"
                  onClick={() => {
                    if (fileInputRef.current) fileInputRef.current.value = '';
                    setFileName(null);
                  }}
                  className="size-9 rounded-md border border-neutral-200 text-neutral-500 hover:text-rose-600 hover:border-rose-200 transition flex items-center justify-center"
                  aria-label="clear"
                >
                  <X className="size-4" />
                </button>
              )}
            </div>
            <input
              id="file-input"
              ref={fileInputRef}
              name="file"
              type="file"
              accept=".pdf,.jpg,.jpeg,.png,.webp,.heic,.heif,.doc,.docx,.xls,.xlsx"
              className="sr-only"
              required
              onChange={(e) => {
                setClientFileError(null);
                const f = e.target.files?.[0];
                if (f) {
                  const err = validateFile(f);
                  if (err) {
                    setClientFileError(err);
                    e.target.value = '';
                    setFileName(null);
                    return;
                  }
                }
                setFileName(f?.name ?? null);
              }}
            />
          </FormField>

          <FormField label={t('categoryLabel')} required error={fieldErrors.category_id}>
            <NativeSelect name="category_id" defaultValue={defaultCategoryId} required>
              {filteredCategories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name_he}
                </option>
              ))}
            </NativeSelect>
          </FormField>

          <FormField label={t('borrowerLabel')}>
            <NativeSelect name="borrower_id" defaultValue="">
              <option value="">{t('borrowerGeneral')}</option>
              {borrowers.map((b) => (
                <option key={b.id} value={b.id}>
                  {[b.firstName, b.lastName].filter(Boolean).join(' ') || '—'}
                </option>
              ))}
            </NativeSelect>
          </FormField>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField label={t('expiryLabel')}>
              <Input name="expiry_date" type="date" />
            </FormField>
          </div>

          <FormField label={t('notesLabel')}>
            <Textarea name="notes" rows={2} />
          </FormField>

          {genericError && (
            <div className="rounded-md bg-rose-50 border border-rose-200 px-3 py-2 text-sm text-rose-700">
              {genericError}
            </div>
          )}

          <DialogFooter>
            <SubmitButton />
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
              className="h-10"
            >
              {t('cancel')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
