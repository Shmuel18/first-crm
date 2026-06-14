'use client';

import { useRef, useState } from 'react';

import { FileText, Loader2, Paperclip, Upload, X } from 'lucide-react';
import { useTranslations } from 'next-intl';

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ALLOWED_MIME_TYPES, MAX_FILE_SIZE_BYTES } from '@/features/documents/schemas/document.schema';

import { listCaseDocumentsForEmailAction } from '../actions/list-case-documents-for-email';
import { prepareEmailAttachmentAction } from '../actions/prepare-email-attachment';
import {
  MAX_ATTACHMENT_COUNT,
  MAX_TOTAL_ATTACHMENT_BYTES,
} from '../domain/email-attachment-limits';

import type { EmailDocumentOption } from '../actions/list-case-documents-for-email';

/** One selected attachment: an existing case document, or a freshly uploaded blob. */
export type ClientEmailAttachmentItem =
  | { kind: 'document'; id: string; fileName: string; fileSize: number | null }
  | { kind: 'upload'; path: string; fileName: string; fileSize: number };

type Props = {
  caseId: string;
  items: ClientEmailAttachmentItem[];
  onChange: (items: ClientEmailAttachmentItem[]) => void;
  /** True while a new file is uploading — the parent disables Send meanwhile. */
  onUploadingChange: (uploading: boolean) => void;
  disabled?: boolean;
};

const ACCEPT = '.pdf,.jpg,.jpeg,.png,.webp,.heic,.heif,.doc,.docx,.xls,.xlsx';

function formatBytes(bytes: number | null): string {
  if (bytes == null) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function EmailAttachmentsField({
  caseId,
  items,
  onChange,
  onUploadingChange,
  disabled,
}: Props) {
  const t = useTranslations('composeEmail.attachments');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [docs, setDocs] = useState<EmailDocumentOption[] | null>(null);
  const [loadingDocs, setLoadingDocs] = useState(false);

  const totalBytes = items.reduce((sum, i) => sum + (i.fileSize ?? 0), 0);
  const atCount = items.length >= MAX_ATTACHMENT_COUNT;

  const remove = (index: number): void => {
    setError(null);
    onChange(items.filter((_, i) => i !== index));
  };

  const add = (item: ClientEmailAttachmentItem): void => onChange([...items, item]);

  const validateFile = (file: File): string | null => {
    if (file.size === 0) return t('uploadFailed');
    if (file.size > MAX_FILE_SIZE_BYTES) return t('tooLarge');
    if (!(ALLOWED_MIME_TYPES as readonly string[]).includes(file.type)) {
      return t('fileTypeNotAllowed');
    }
    if (totalBytes + file.size > MAX_TOTAL_ATTACHMENT_BYTES) return t('tooLarge');
    return null;
  };

  async function handleFile(file: File): Promise<void> {
    setError(null);
    if (atCount) return setError(t('tooMany'));
    const invalid = validateFile(file);
    if (invalid) return setError(invalid);

    setUploading(true);
    onUploadingChange(true);
    try {
      const prep = await prepareEmailAttachmentAction({
        caseId,
        fileName: file.name,
        fileSize: file.size,
        mimeType: file.type,
      });
      if (!prep.ok) return setError(t('uploadFailed'));
      const put = await fetch(prep.signedUrl, {
        method: 'PUT',
        headers: { 'Content-Type': file.type, 'x-upsert': 'false' },
        body: file,
      });
      if (!put.ok) return setError(t('uploadFailed'));
      add({ kind: 'upload', path: prep.path, fileName: prep.safeFileName, fileSize: file.size });
    } catch {
      setError(t('uploadFailed'));
    } finally {
      setUploading(false);
      onUploadingChange(false);
    }
  }

  async function loadDocs(): Promise<void> {
    if (docs !== null || loadingDocs) return;
    setLoadingDocs(true);
    const res = await listCaseDocumentsForEmailAction(caseId);
    setDocs(res.ok ? res.documents : []);
    setLoadingDocs(false);
  }

  const addDoc = (doc: EmailDocumentOption): void => {
    setError(null);
    if (atCount) return setError(t('tooMany'));
    if (items.some((i) => i.kind === 'document' && i.id === doc.id)) return;
    add({ kind: 'document', id: doc.id, fileName: doc.fileName, fileSize: doc.fileSize });
  };

  return (
    <div>
      <span className="mb-1 block text-xs font-medium text-neutral-600">{t('label')}</span>

      {items.length > 0 && (
        <ul className="mb-2 space-y-1">
          {items.map((item, index) => (
            <li
              key={item.kind === 'document' ? `d:${item.id}` : `u:${item.path}`}
              className="flex items-center gap-2 rounded-md border border-neutral-200 bg-neutral-50 px-2 py-1 text-sm"
            >
              {item.kind === 'document' ? (
                <FileText className="size-3.5 shrink-0 text-brand-gold-text" aria-hidden="true" />
              ) : (
                <Upload className="size-3.5 shrink-0 text-neutral-500" aria-hidden="true" />
              )}
              <span className="flex-1 truncate">{item.fileName}</span>
              {item.fileSize != null && (
                <span className="shrink-0 text-[10px] text-neutral-400">
                  {formatBytes(item.fileSize)}
                </span>
              )}
              <button
                type="button"
                disabled={disabled}
                onClick={() => remove(index)}
                className="shrink-0 text-neutral-400 transition hover:text-rose-600 disabled:opacity-50"
                aria-label={t('remove')}
              >
                <X className="size-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}

      <DropdownMenu onOpenChange={(open) => open && void loadDocs()}>
        <DropdownMenuTrigger
          render={
            <button
              type="button"
              disabled={disabled || uploading || atCount}
              className="flex items-center gap-1.5 rounded-md border border-neutral-200 px-2.5 py-1 text-xs font-medium text-neutral-600 transition hover:border-brand-gold-text hover:text-brand-gold-text disabled:opacity-50"
            />
          }
        >
          {uploading ? (
            <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
          ) : (
            <Paperclip className="size-3.5" aria-hidden="true" />
          )}
          {t('add')}
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="max-h-72 w-64 overflow-y-auto">
          <DropdownMenuItem onClick={() => fileInputRef.current?.click()} className="gap-2">
            <Upload className="size-4 text-neutral-500" aria-hidden="true" />
            {t('fromComputer')}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <div className="px-2 py-1 text-[10px] font-semibold tracking-wide text-neutral-400 uppercase">
            {t('fromCase')}
          </div>
          {loadingDocs && (
            <div className="flex items-center gap-2 px-2 py-1.5 text-xs text-neutral-500">
              <Loader2 className="size-3.5 animate-spin" /> {t('loading')}
            </div>
          )}
          {docs !== null && docs.length === 0 && !loadingDocs && (
            <div className="px-2 py-1.5 text-xs text-neutral-400">{t('noDocuments')}</div>
          )}
          {docs?.map((doc) => (
            <DropdownMenuItem
              key={doc.id}
              disabled={items.some((i) => i.kind === 'document' && i.id === doc.id)}
              onClick={() => addDoc(doc)}
              className="gap-2"
            >
              <FileText className="size-4 shrink-0 text-brand-gold-text" aria-hidden="true" />
              <span className="flex-1 truncate">{doc.fileName}</span>
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      {error && <p className="mt-1 text-xs text-rose-600">{error}</p>}

      <input
        ref={fileInputRef}
        type="file"
        accept={ACCEPT}
        className="sr-only"
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = '';
          if (f) void handleFile(f);
        }}
      />
    </div>
  );
}
