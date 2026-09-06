'use client';

import { useState, useTransition } from 'react';

import { useLocale, useTranslations } from 'next-intl';
import { toast } from 'sonner';

import { ComposeEmailDialog } from '@/components/shared/compose-email-dialog';
import { buildWhatsAppLink } from '@/features/borrowers/domain/contact-links';
import type { RenderedTemplate } from '@/features/templates/types';
import { callAction } from '@/lib/actions/call-action';

import { sendClientEmailAction } from '../actions/send-client-email';
import { defaultRecipientIds, selectedRecipients } from '../domain/email-recipients';
import { EmailAttachmentsField } from './email-attachments-field';
import { EmailRecipientsField } from './email-recipients-field';
import { SendClientMessageMenu } from './send-client-message-menu';

import type { EmailRecipient } from '../domain/email-recipients';
import type { ClientEmailAttachmentItem } from './email-attachments-field';

type Props = {
  /** Case id — needed to send a branded email server-side. */
  caseId: string;
  /** Tooltip / aria-label for the trigger icon. */
  title: string;
  /** Primary borrower contact — drives the WhatsApp channel and its greeting.
   *  Null (no borrower yet) leaves WhatsApp disabled. */
  borrower: {
    firstName: string | null;
    lastName: string | null;
    email: string | null;
    phone: string | null;
  } | null;
  /** Everyone on the case with an address, primary first. Empty disables the
   *  email channel; the advisor picks among them inside the dialog. */
  emailRecipients: ReadonlyArray<EmailRecipient>;
  /** Active message templates, merge fields already substituted server-side.
   *  Empty array hides the templates section. */
  templates: ReadonlyArray<RenderedTemplate>;
  /** Flag+permission-gated by the server action bar: shows the AI draft strip
   *  inside the compose dialog (ai-v2-spec.md §4.2). */
  aiDraftEnabled?: boolean;
};

type Draft = { subject: string; body: string };

/**
 * "Send message to client" from the case action bar. Email — and email-channel
 * templates — open an editable preview dialog addressed to the borrowers the
 * advisor picks, then send through the branded layout (reply-to office@).
 * WhatsApp — and WhatsApp templates — open the wa.me composer prefilled (the
 * advisor reviews + sends inside WhatsApp).
 */
export function SendClientMessageButton({
  caseId,
  title,
  borrower,
  emailRecipients,
  templates,
  aiDraftEnabled,
}: Props) {
  const t = useTranslations('case.actionBar.sendMessageMenu');
  const uiLocale = useLocale();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [recipientIds, setRecipientIds] = useState<string[]>([]);
  const [attachments, setAttachments] = useState<ClientEmailAttachmentItem[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [isPending, startTransition] = useTransition();

  const closeDialog = (): void => {
    setDraft(null);
    setAttachments([]);
  };

  const firstName = borrower?.firstName?.trim() ?? '';
  const greeting = firstName
    ? t('whatsappGreeting', { name: firstName })
    : t('whatsappGreetingNoName');
  const waLink = buildWhatsAppLink(borrower?.phone, greeting);
  const hasEmail = emailRecipients.length > 0;

  /** Greeting for a fresh email draft: the given names it is addressed to.
   *  Fixed at open — a later recipient change must not overwrite edited text. */
  const emailGreeting = (ids: ReadonlyArray<string>): string => {
    const names = selectedRecipients(emailRecipients, ids).flatMap((r) =>
      r.firstName?.trim() ? [r.firstName.trim()] : [],
    );
    if (names.length === 0) return greeting;
    const joined = new Intl.ListFormat(uiLocale === 'en' ? 'en' : 'he', {
      type: 'conjunction',
    }).format(names);
    return t('whatsappGreeting', { name: joined });
  };

  /** Open the compose dialog addressed to the default recipients. */
  const openEmail = (subject: string, body?: string): void => {
    const ids = defaultRecipientIds(emailRecipients);
    setRecipientIds(ids);
    setDraft({ subject, body: body ?? `${emailGreeting(ids)}\n\n` });
  };

  const openWhatsApp = (text?: string): void => {
    const link = buildWhatsAppLink(borrower?.phone, text ?? greeting);
    if (link) window.open(link, '_blank', 'noopener,noreferrer');
  };

  // email + email-channel templates → editable preview; 'general' templates
  // prefer WhatsApp and fall back to the email dialog when there is no phone.
  const openTemplate = (tpl: RenderedTemplate): void => {
    const wantsWhatsApp = tpl.channel === 'whatsapp' || (tpl.channel === 'general' && waLink);
    if (wantsWhatsApp) {
      openWhatsApp(tpl.body);
      return;
    }
    openEmail(tpl.subject?.trim() || t('emailDefaultSubject'), tpl.body);
  };

  const send = (subject: string, body: string, emailLocale: 'he' | 'en'): void => {
    startTransition(async () => {
      const documentIds = attachments.flatMap((a) => (a.kind === 'document' ? [a.id] : []));
      const uploads = attachments.flatMap((a) =>
        a.kind === 'upload' ? [{ path: a.path, fileName: a.fileName }] : [],
      );
      const res = await callAction(() =>
        sendClientEmailAction({
          caseId,
          locale: emailLocale,
          subject,
          body,
          recipientBorrowerIds: recipientIds,
          documentIds,
          uploads,
        }),
      );
      if (res.ok) {
        toast.success(t('emailSent'));
        closeDialog();
        return;
      }
      const key =
        res.error === 'no_email'
          ? 'emailNoAddress'
          : res.error === 'not_configured'
            ? 'emailNotConfigured'
            : res.error === 'unauthorized'
              ? 'emailUnauthorized'
              : res.error === 'attachment'
                ? 'emailAttachmentFailed'
                : 'emailFailed';
      toast.error(t(key));
      // Keep the dialog (and attachments) open on a transient/attachment error
      // so the advisor can retry without re-attaching.
      if (res.error !== 'unknown' && res.error !== 'attachment') closeDialog();
    });
  };

  return (
    <>
      <SendClientMessageMenu
        title={title}
        hasEmail={hasEmail}
        hasPhone={Boolean(waLink)}
        templates={templates}
        onEmail={() => openEmail(t('emailDefaultSubject'))}
        onWhatsApp={() => openWhatsApp()}
        onTemplate={openTemplate}
      />

      <ComposeEmailDialog
        open={draft !== null}
        onOpenChange={(open) => !open && closeDialog()}
        title={title}
        initialSubject={draft?.subject ?? ''}
        initialBody={draft?.body ?? ''}
        pending={isPending || isUploading}
        sendDisabled={recipientIds.length === 0}
        onSend={send}
        aiDraftCaseId={aiDraftEnabled ? caseId : undefined}
        headerFields={
          <EmailRecipientsField
            recipients={emailRecipients}
            selectedIds={recipientIds}
            onChange={setRecipientIds}
            disabled={isPending}
          />
        }
        extraFields={
          <EmailAttachmentsField
            caseId={caseId}
            items={attachments}
            onChange={setAttachments}
            onUploadingChange={setIsUploading}
            disabled={isPending}
          />
        }
      />
    </>
  );
}
