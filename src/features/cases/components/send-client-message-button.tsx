'use client';

import { useState, useTransition } from 'react';

import { FileText, Mail, MessageCircle, MessageSquare } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';

import { ComposeEmailDialog } from '@/components/shared/compose-email-dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Tooltip } from '@/components/ui/tooltip';
import { buildWhatsAppLink } from '@/features/borrowers/domain/contact-links';
import type { RenderedTemplate } from '@/features/templates/types';

import { sendClientEmailAction } from '../actions/send-client-email';
import { EmailAttachmentsField } from './email-attachments-field';

import type { ClientEmailAttachmentItem } from './email-attachments-field';

type Props = {
  /** Case id — needed to send a branded email server-side. */
  caseId: string;
  /** Tooltip / aria-label for the trigger icon. */
  title: string;
  /** Primary borrower contact — gates the menu items and prefills the greeting.
   *  Null (no borrower yet) leaves both channels disabled. */
  borrower: {
    firstName: string | null;
    lastName: string | null;
    email: string | null;
    phone: string | null;
  } | null;
  /** Active message templates, merge fields already substituted server-side.
   *  Empty array hides the templates section. */
  templates: ReadonlyArray<RenderedTemplate>;
};

type Draft = { subject: string; body: string };

/**
 * "Send message to client" from the case action bar. Email — and email-channel
 * templates — open an editable preview dialog, then send through the branded
 * layout (reply-to office@). WhatsApp — and WhatsApp templates — open the
 * wa.me composer prefilled (the advisor reviews + sends inside WhatsApp). Each
 * item is disabled when the matching contact field is empty.
 */
export function SendClientMessageButton({ caseId, title, borrower, templates }: Props) {
  const t = useTranslations('case.actionBar.sendMessageMenu');
  const [draft, setDraft] = useState<Draft | null>(null);
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
  const hasEmail = Boolean(borrower?.email?.trim());

  const openWhatsApp = (text?: string): void => {
    const link = buildWhatsAppLink(borrower?.phone, text ?? greeting);
    if (link) window.open(link, '_blank', 'noopener,noreferrer');
  };

  // email + email-channel templates → editable preview; 'general' templates
  // prefer WhatsApp and fall back to the email dialog when there's no phone.
  const openTemplate = (tpl: RenderedTemplate): void => {
    const wantsWhatsApp = tpl.channel === 'whatsapp' || (tpl.channel === 'general' && waLink);
    if (wantsWhatsApp) {
      openWhatsApp(tpl.body);
      return;
    }
    setDraft({ subject: tpl.subject?.trim() || t('emailDefaultSubject'), body: tpl.body });
  };

  const send = (subject: string, body: string, locale: 'he' | 'en'): void => {
    startTransition(async () => {
      const documentIds = attachments.flatMap((a) => (a.kind === 'document' ? [a.id] : []));
      const uploads = attachments.flatMap((a) =>
        a.kind === 'upload' ? [{ path: a.path, fileName: a.fileName }] : [],
      );
      const res = await sendClientEmailAction({ caseId, locale, subject, body, documentIds, uploads });
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
      <DropdownMenu>
        <Tooltip content={title}>
          <DropdownMenuTrigger
            render={
              <button
                type="button"
                aria-label={title}
                className="relative flex size-8 items-center justify-center rounded-md text-neutral-600 transition hover:bg-white hover:text-brand-gold-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold-text/50"
              />
            }
          >
            <MessageSquare className="size-3.5" aria-hidden="true" />
          </DropdownMenuTrigger>
        </Tooltip>
        <DropdownMenuContent align="end" className="w-64">
          <DropdownMenuItem
            disabled={!hasEmail}
            onClick={() =>
              hasEmail && setDraft({ subject: t('emailDefaultSubject'), body: `${greeting}\n\n` })
            }
            className="gap-2"
          >
            <Mail className="size-4 text-neutral-500" aria-hidden="true" />
            <span className="flex-1">{t('viaEmail')}</span>
            {!hasEmail && <span className="text-[10px] text-neutral-500">{t('noEmail')}</span>}
          </DropdownMenuItem>
          <DropdownMenuItem
            disabled={!waLink}
            onClick={() => openWhatsApp()}
            className="gap-2"
          >
            <MessageCircle className="size-4 text-emerald-600" aria-hidden="true" />
            <span className="flex-1">{t('viaWhatsapp')}</span>
            {!waLink && <span className="text-[10px] text-neutral-500">{t('noPhone')}</span>}
          </DropdownMenuItem>

          {templates.length > 0 && (
            <>
              <div className="mt-1 border-t border-neutral-100 px-2 pt-2 pb-1 text-[10px] font-semibold tracking-wide text-neutral-400 uppercase">
                {t('templatesLabel')}
              </div>
              {templates.map((tpl) => {
                const usable = tpl.channel === 'email' ? hasEmail : Boolean(waLink) || hasEmail;
                return (
                  <DropdownMenuItem
                    key={tpl.id}
                    disabled={!usable}
                    onClick={() => usable && openTemplate(tpl)}
                    className="gap-2"
                  >
                    <FileText className="size-4 text-brand-gold-text" aria-hidden="true" />
                    <span className="flex-1 truncate">{tpl.name}</span>
                    {!usable && (
                      <span className="text-[10px] text-neutral-500">{t('noContact')}</span>
                    )}
                  </DropdownMenuItem>
                );
              })}
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <ComposeEmailDialog
        open={draft !== null}
        onOpenChange={(open) => !open && closeDialog()}
        title={title}
        initialSubject={draft?.subject ?? ''}
        initialBody={draft?.body ?? ''}
        pending={isPending || isUploading}
        onSend={send}
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
