'use client';

import { useState, useTransition } from 'react';

import { useTranslations } from 'next-intl';
import { toast } from 'sonner';

import { ComposeEmailDialog } from '@/components/shared/compose-email-dialog';
import { Input } from '@/components/ui/input';
import {
  EmailAttachmentsField,
  type ClientEmailAttachmentItem,
} from '@/features/cases/components/email-attachments-field';
import { callAction } from '@/lib/actions/call-action';

import { sendDocumentsEmailAction } from '../actions/send-documents-email';

type Props = {
  caseId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Prefills the recipient (usually the client's address); the advisor
   *  overwrites it when sending to a banker. */
  defaultRecipient: string | null;
  /** Documents preselected by the caller (e.g. "send this one" from preview). */
  initialAttachments: ClientEmailAttachmentItem[];
  /** Enables the "link the Drive folder instead" option. */
  hasDriveFolder: boolean;
};

const isEmail = (value: string): boolean => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());

/**
 * "Send documents by email" from the documents screen: pick files already
 * filed on the case, address it to anyone (banker, appraiser, client), review
 * the text, send. Same attachment pipeline and caps as the case-page client
 * email; over the cap, the Drive-folder link replaces the attachments.
 */
export function SendDocumentsEmailDialog({
  caseId,
  open,
  onOpenChange,
  defaultRecipient,
  initialAttachments,
  hasDriveFolder,
}: Props) {
  const t = useTranslations('documents.sendEmail');
  const [recipient, setRecipient] = useState(defaultRecipient ?? '');
  const [attachments, setAttachments] = useState<ClientEmailAttachmentItem[]>(initialAttachments);
  const [includeDriveLink, setIncludeDriveLink] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [isPending, startTransition] = useTransition();

  const send = (subject: string, body: string, locale: 'he' | 'en'): void => {
    startTransition(async () => {
      const res = await callAction(() =>
        sendDocumentsEmailAction({
          caseId,
          to: recipient.trim(),
          locale,
          subject,
          body,
          documentIds: attachments.flatMap((a) => (a.kind === 'document' ? [a.id] : [])),
          uploads: attachments.flatMap((a) =>
            a.kind === 'upload' ? [{ path: a.path, fileName: a.fileName }] : [],
          ),
          includeDriveLink,
        }),
      );
      if (res.ok) {
        toast.success(t('sent'));
        onOpenChange(false);
        return;
      }
      const key =
        res.error === 'unauthorized'
          ? 'errors.unauthorized'
          : res.error === 'attachment'
            ? 'errors.attachment'
            : res.error === 'no_folder'
              ? 'errors.noFolder'
              : 'errors.generic';
      toast.error(t(key));
    });
  };

  return (
    <ComposeEmailDialog
      open={open}
      onOpenChange={onOpenChange}
      title={t('title')}
      initialSubject={t('defaultSubject')}
      initialBody={t('defaultBody')}
      pending={isPending}
      sendDisabled={uploading || !isEmail(recipient)}
      onSend={send}
      headerFields={
        <div>
          <label
            htmlFor="send-docs-recipient"
            className="mb-1 block text-xs font-medium text-neutral-600"
          >
            {t('recipientLabel')}
          </label>
          <Input
            id="send-docs-recipient"
            type="email"
            dir="ltr"
            value={recipient}
            onChange={(e) => setRecipient(e.target.value)}
            placeholder={t('recipientPlaceholder')}
            maxLength={254}
          />
          <p className="mt-1 text-[11px] text-neutral-500">{t('recipientHint')}</p>
        </div>
      }
      extraFields={
        <div className="space-y-2">
          <EmailAttachmentsField
            caseId={caseId}
            items={attachments}
            onChange={setAttachments}
            onUploadingChange={setUploading}
            disabled={isPending}
          />
          {hasDriveFolder && (
            <label className="flex items-start gap-2 text-xs text-neutral-700">
              <input
                type="checkbox"
                checked={includeDriveLink}
                onChange={(e) => setIncludeDriveLink(e.target.checked)}
                className="mt-0.5 size-3.5 accent-brand-gold-dark"
              />
              <span>{t('driveLinkOption')}</span>
            </label>
          )}
        </div>
      }
    />
  );
}
