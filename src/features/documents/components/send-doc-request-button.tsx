'use client';

import { useState, useTransition } from 'react';

import { Mail, MessageCircle, MessageSquare } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
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
import { env } from '@/lib/env';
import { parseLocale } from '@/lib/i18n/direction';

import { sendDocumentRequestAction } from '../actions/send-document-request';
import type { DocumentChecklistItem } from '../services/document-checklist.service';

type Props = {
  caseId: string;
  /** Tooltip / aria-label for the trigger icon. */
  title: string;
  /** Primary borrower contact info ג€” used to gate the menu items and to
   *  prefill the WhatsApp composer with a personalised greeting. */
  borrower: {
    firstName: string | null;
    lastName: string | null;
    email: string | null;
    phone: string | null;
  } | null;
  /** Required-docs checklist for this case. The WhatsApp message lists
   *  the still-missing categories so the borrower knows exactly what to
   *  send back. Empty / null falls back to a generic prompt. */
  checklist: ReadonlyArray<DocumentChecklistItem> | null;
};

/**
 * Dual-channel "request docs from borrower" entry point on the documents
 * action bar:
 *   - Email: opens the existing confirm dialog ג†’ Resend template
 *   - WhatsApp: opens wa.me deep-link with a prefilled message (no server
 *     roundtrip). The advisor reviews + hits send inside WhatsApp.
 *
 * Each option is disabled when the corresponding contact field is empty
 * (email / phone). The trigger icon stays the speech-bubble already used
 * on this bar, so the chrome doesn't change for advisors who only use
 * one channel.
 */
export function SendDocRequestButton({ caseId, title, borrower, checklist }: Props) {
  const t = useTranslations('documents.request');
  const tMenu = useTranslations('documents.requestMenu');
  const tc = useTranslations('common');
  const locale = parseLocale(useLocale());
  const [draft, setDraft] = useState<{ subject: string; body: string } | null>(null);
  const [isPending, startTransition] = useTransition();

  const fullName =
    [borrower?.firstName, borrower?.lastName].filter(Boolean).join(' ').trim() ||
    tc('noName');
  const waLink = buildWhatsAppLink(
    borrower?.phone,
    buildWhatsappText({ name: fullName, checklist, locale, tMenu }),
  );
  const hasEmail = Boolean(borrower?.email?.trim());

  // Prefill on open (not on mount) so the draft always reflects the current
  // checklist, and a reopened dialog starts fresh rather than half-edited.
  const openEmailDialog = (): void => {
    setDraft({
      subject: t('emailSubject'),
      body: buildEmailText({ name: fullName, checklist, locale, t }),
    });
  };

  const sendEmail = (subject: string, body: string, emailLocale: 'he' | 'en'): void => {
    startTransition(async () => {
      const res = await sendDocumentRequestAction({ caseId, locale: emailLocale, subject, body });
      if (res.ok) {
        toast.success(t('sent'));
        setDraft(null);
        return;
      }
      const key =
        res.error === 'no_email'
          ? 'noEmail'
          : res.error === 'not_configured'
            ? 'notConfigured'
            : res.error === 'unauthorized'
              ? 'unauthorized'
              : 'failed';
      toast.error(t(key));
      if (res.error !== 'unknown') setDraft(null);
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
                className="flex size-8 items-center justify-center rounded-md text-neutral-700 transition hover:bg-white hover:text-brand-gold-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold-text/50"
              />
            }
          >
            <MessageSquare className="size-3.5" aria-hidden="true" />
          </DropdownMenuTrigger>
        </Tooltip>
        <DropdownMenuContent align="end" className="w-60">
          <DropdownMenuItem
            disabled={!hasEmail}
            onClick={() => hasEmail && openEmailDialog()}
            className="gap-2"
          >
            <Mail className="size-4 text-neutral-500" aria-hidden="true" />
            <span className="flex-1">{tMenu('viaEmail')}</span>
            {!hasEmail && (
              <span className="text-[10px] text-neutral-500">{tMenu('noEmail')}</span>
            )}
          </DropdownMenuItem>
          <DropdownMenuItem
            disabled={!waLink}
            onClick={() => waLink && window.open(waLink, '_blank', 'noopener,noreferrer')}
            className="gap-2"
          >
            <MessageCircle className="size-4 text-emerald-600" aria-hidden="true" />
            <span className="flex-1">{tMenu('viaWhatsapp')}</span>
            {!waLink && (
              <span className="text-[10px] text-neutral-500">{tMenu('noPhone')}</span>
            )}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <ComposeEmailDialog
        open={draft !== null}
        onOpenChange={(open) => !open && setDraft(null)}
        title={title}
        initialSubject={draft?.subject ?? ''}
        initialBody={draft?.body ?? ''}
        pending={isPending}
        onSend={sendEmail}
      />
    </>
  );
}

type MenuT = ReturnType<typeof useTranslations>;

/**
 * Prefill for the editable email draft — greeting, ask, missing-required-docs
 * bullets and a signoff, in the advisor's UI language. Mirrors the WhatsApp
 * builder below so both channels start from the same message.
 */
function buildEmailText({
  name,
  checklist,
  locale,
  t,
}: {
  name: string;
  checklist: ReadonlyArray<DocumentChecklistItem> | null;
  locale: 'he' | 'en';
  t: MenuT;
}): string {
  const missing = (checklist ?? []).filter((i) => i.isRequired && i.status === 'missing');
  const lines = [t('emailGreeting', { name }), '', t('emailBody')];
  if (missing.length > 0) {
    lines.push('', t('emailDocsIntro'));
    for (const item of missing) lines.push(`• ${locale === 'he' ? item.nameHe : item.nameEn}`);
  }
  lines.push('', t('emailSignoff', { office: env.NEXT_PUBLIC_APP_NAME }));
  return lines.join('\n');
}

/**
 * Build the prefilled WhatsApp message. Pulls the missing-required docs
 * out of the checklist and lists them as bullets in the current locale.
 * Falls back to a generic "we need more docs, please reach out" when the
 * checklist is empty or every required doc is already in.
 */
function buildWhatsappText({
  name,
  checklist,
  locale,
  tMenu,
}: {
  name: string;
  checklist: ReadonlyArray<DocumentChecklistItem> | null;
  locale: 'he' | 'en';
  tMenu: MenuT;
}): string {
  const missing = (checklist ?? []).filter((i) => i.isRequired && i.status === 'missing');
  if (missing.length === 0) {
    return tMenu('whatsappTemplateNoMissing', { name });
  }
  const docList = missing
    .map((i) => `- ${locale === 'he' ? i.nameHe : i.nameEn}`)
    .join('\n');
  return tMenu('whatsappTemplate', { name, docList });
}
