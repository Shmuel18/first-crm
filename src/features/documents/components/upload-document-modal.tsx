'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { Loader2 } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { Button } from '@/components/ui/button';
import { DateInputWithPicker } from '@/components/ui/date-input-with-picker';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { FormField, NativeSelect } from '@/components/shared/form-fields';
import { formatPersonName } from '@/lib/utils/person-name';

import { getUploadFileError, MAX_FILES_PER_UPLOAD } from '../domain/upload-file-check';
import { useMultiUpload } from '../hooks/use-multi-upload';
import { type DocumentCategoryRow, type DriveFolder } from '../types';

import { UploadFilePicker } from './upload-file-picker';

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  caseId: string;
  categories: ReadonlyArray<DocumentCategoryRow>;
  borrowers: ReadonlyArray<{ id: string; firstName: string | null; lastName: string | null }>;
  defaultFolder?: DriveFolder | null;
};

/**
 * Upload one or more files into a case (up to MAX_FILES_PER_UPLOAD per batch,
 * by drag-and-drop or the picker). Type / borrower / expiry / notes apply to
 * every file in the batch. The upload flow itself lives in useMultiUpload;
 * failed files stay listed with their error so the user can retry just those.
 */
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
  const router = useRouter();
  const { progress, uploadAll } = useMultiUpload(caseId);
  const [files, setFiles] = useState<File[]>([]);
  const [failedNames, setFailedNames] = useState<ReadonlyMap<string, string>>(new Map());
  const [clientFileError, setClientFileError] = useState<string | null>(null);
  const [genericError, setGenericError] = useState<string | null>(null);
  const pending = progress !== null;

  const errorText = (key: string): string =>
    key === 'fileRequired' || key === 'fileTooLarge' || key === 'fileTypeNotAllowed'
      ? tErr(key)
      : tErr('uploadFailed');

  // Valid files join the list (deduped by name + size); a refused one is
  // reported by name instead of silently vanishing from a multi-file drop.
  const addFiles = (incoming: File[]): void => {
    setClientFileError(null);
    const rejected = incoming.find((f) => getUploadFileError(f) !== null);
    const valid = incoming.filter(
      (f) =>
        getUploadFileError(f) === null &&
        !files.some((x) => x.name === f.name && x.size === f.size),
    );
    const merged = [...files, ...valid];
    if (merged.length > MAX_FILES_PER_UPLOAD) {
      setClientFileError(t('tooManyFiles', { max: MAX_FILES_PER_UPLOAD }));
    } else if (rejected) {
      const reason = errorText(getUploadFileError(rejected) ?? 'uploadFailed');
      setClientFileError(t('fileRejected', { name: rejected.name, reason }));
    }
    setFiles(merged.slice(0, MAX_FILES_PER_UPLOAD));
  };

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>): Promise<void> {
    e.preventDefault();
    if (pending) return;
    setGenericError(null);
    if (files.length === 0) {
      setClientFileError(tErr('fileRequired'));
      return;
    }

    const formData = new FormData(e.currentTarget);
    const categoryId = String(formData.get('category_id') ?? '');
    if (!categoryId) {
      // The form is noValidate, so the empty "choose a type" option has to be
      // rejected here. A silent default used to file everything under the
      // FIRST category (תעודת זהות) — documents the office meant for שונות
      // landed in זהות וקשר, in Drive too, and read as a filing crash.
      setGenericError(tErr('categoryRequired'));
      return;
    }
    const failures = await uploadAll(files, {
      categoryId,
      borrowerId: String(formData.get('borrower_id') ?? '') || null,
      expiryDate: String(formData.get('expiry_date') ?? '') || null,
      notes: String(formData.get('notes') ?? '') || null,
    });

    // Refresh in the background once anything landed (the action no longer
    // revalidates; that spun the button on the heavy documents re-render).
    if (failures.length < files.length) router.refresh();
    if (failures.length === 0) {
      setFiles([]);
      setFailedNames(new Map());
      onOpenChange(false);
      return;
    }
    setFiles(failures.map((f) => f.file));
    setFailedNames(new Map(failures.map((f) => [f.file.name, f.errorKey])));
    setGenericError(t('someFailed', { count: failures.length }));
  }

  const filteredCategories = defaultFolder
    ? categories.filter((c) => c.drive_folder === defaultFolder)
    : categories;

  // Opened from inside a folder → that folder's first category is what the
  // user means. Opened globally → NO default: the wrong silent default files
  // the document (and its Drive copy) under a category the user never chose.
  const defaultCategoryId = defaultFolder ? (filteredCategories[0]?.id ?? '') : '';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>{t('title')}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          <FormField label={t('fileLabel')} required error={clientFileError ?? undefined}>
            <UploadFilePicker
              files={files}
              onAdd={addFiles}
              onRemove={(index) => setFiles((prev) => prev.filter((_, i) => i !== index))}
              failedNames={failedNames}
              errorText={errorText}
              disabled={pending}
            />
          </FormField>

          <FormField label={t('categoryLabel')} required>
            <NativeSelect name="category_id" defaultValue={defaultCategoryId} required>
              {!defaultFolder && <option value="">{t('categoryPlaceholder')}</option>}
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
                  {formatPersonName(b.firstName, b.lastName) || '—'}
                </option>
              ))}
            </NativeSelect>
          </FormField>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField label={t('expiryLabel')}>
              <DateInputWithPicker name="expiry_date" pickerLabel={t('expiryLabel')} />
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
            <Button
              type="submit"
              disabled={pending}
              className="bg-brand-black hover:bg-neutral-800 text-white h-10 min-w-28"
            >
              {progress ? (
                <span className="inline-flex items-center gap-2">
                  <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                  {progress.total > 1 &&
                    t('progress', { current: progress.current, total: progress.total })}
                </span>
              ) : files.length > 1 ? (
                t('submitMany', { count: files.length })
              ) : (
                t('submit')
              )}
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
              className="h-10"
              disabled={pending}
            >
              {t('cancel')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
