'use client';

import { useRef, useState } from 'react';

import { Loader2, Upload as UploadIcon, X } from 'lucide-react';
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

import { finalizeUploadAction } from '../actions/finalize-upload';
import { prepareUploadAction } from '../actions/prepare-upload';
import { ALLOWED_MIME_TYPES, MAX_FILE_SIZE_BYTES } from '../schemas/document.schema';
import { type DocumentCategoryRow, type DriveFolder } from '../types';

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  caseId: string;
  categories: ReadonlyArray<DocumentCategoryRow>;
  borrowers: ReadonlyArray<{ id: string; firstName: string | null; lastName: string | null }>;
  defaultFolder?: DriveFolder | null;
};

/**
 * Direct-to-storage upload (batch 25):
 *
 *   1. prepareUploadAction() returns a signed upload URL + documentId.
 *   2. The browser PUTs the file directly to Supabase Storage — bytes never
 *      pass through the Server Action body (no 21 MB limit, no function
 *      memory pressure).
 *   3. finalizeUploadAction() does the magic-byte sniff (Range GET of first
 *      4 KB), the Drive secondary upload, and the documents INSERT.
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
  const formRef = useRef<HTMLFormElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [clientFileError, setClientFileError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [genericError, setGenericError] = useState<string | null>(null);

  // Mirror of the server-side guards so the user sees the error before a
  // 20 MB file uploads in full and gets rejected post-upload.
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
    const dt = new DataTransfer();
    dt.items.add(dropped);
    fileInputRef.current.files = dt.files;
    setFileName(dropped.name);
  };

  const mapErrorMessage = (key: string | undefined): string => {
    if (!key) return tErr('uploadFailed');
    if (key === 'fileRequired') return tErr('fileRequired');
    if (key === 'fileTooLarge') return tErr('fileTooLarge');
    if (key === 'fileTypeNotAllowed') return tErr('fileTypeNotAllowed');
    return tErr('uploadFailed');
  };

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>): Promise<void> {
    e.preventDefault();
    if (pending) return;
    setGenericError(null);

    const form = e.currentTarget;
    const file = fileInputRef.current?.files?.[0];
    if (!file) {
      setClientFileError(tErr('fileRequired'));
      return;
    }

    const formData = new FormData(form);
    const categoryId = String(formData.get('category_id') ?? '');
    const borrowerIdRaw = String(formData.get('borrower_id') ?? '');
    const expiryRaw = String(formData.get('expiry_date') ?? '');
    const notesRaw = String(formData.get('notes') ?? '');

    setPending(true);
    try {
      // ── Phase 1: ask the server for a signed upload URL ─────────────
      const prep = await prepareUploadAction({
        caseId,
        fileName: file.name,
        fileSize: file.size,
        mimeType: file.type,
        categoryId,
        borrowerId: borrowerIdRaw || null,
      });
      if (!prep.ok) {
        setGenericError(
          prep.error === 'unauthorized'
            ? tErr('uploadFailed')
            : mapErrorMessage(prep.message),
        );
        return;
      }

      // ── Phase 2: browser uploads bytes directly to Storage ──────────
      const putRes = await fetch(prep.signedUrl, {
        method: 'PUT',
        headers: {
          'Content-Type': file.type,
          // Supabase signed-upload URLs accept the token via Authorization header.
          // The signed URL embeds the token too, so this header is sometimes
          // redundant — keeping it explicit makes the intent clear.
          'x-upsert': 'false',
        },
        body: file,
      });
      if (!putRes.ok) {
        setGenericError(tErr('uploadFailed'));
        return;
      }

      // ── Phase 3: finalize — magic-byte check + Drive + DB row ───────
      const final = await finalizeUploadAction({
        documentId: prep.documentId,
        caseId,
        storagePath: prep.path,
        fileName: prep.safeFileName,
        fileSize: file.size,
        mimeType: file.type,
        categoryId,
        borrowerId: borrowerIdRaw || null,
        expiryDate: expiryRaw || null,
        notes: notesRaw || null,
      });
      if (!final.ok) {
        setGenericError(mapErrorMessage(final.message));
        return;
      }

      // Success — close the modal. The parent should remount via
      // key={String(open)} so all internal state resets cleanly.
      onOpenChange(false);
    } catch {
      setGenericError(tErr('uploadFailed'));
    } finally {
      setPending(false);
    }
  }

  const filteredCategories = defaultFolder
    ? categories.filter((c) => c.drive_folder === defaultFolder)
    : categories;

  const defaultCategoryId = filteredCategories[0]?.id ?? '';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>{t('title')}</DialogTitle>
        </DialogHeader>

        <form ref={formRef} onSubmit={handleSubmit} className="space-y-4" noValidate>
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

          <FormField label={t('categoryLabel')} required>
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
              {pending ? <Loader2 className="size-4 animate-spin" /> : t('submit')}
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
