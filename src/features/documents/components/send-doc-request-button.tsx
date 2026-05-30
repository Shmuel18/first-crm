'use client';

import { useState, useTransition } from 'react';

import { Loader2, Mail, MessageCircle, MessageSquare } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Tooltip } from '@/components/ui/tooltip';
import { buildWhatsAppLink } from '@/features/borrowers/domain/contact-links';
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
  const [emailOpen, setEmailOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  const fullName =
    [borrower?.firstName, borrower?.lastName].filter(Boolean).join(' ').trim() ||
    tc('noName');
  const waLink = buildWhatsAppLink(
    borrower?.phone,
    buildWhatsappText({ name: fullName, checklist, locale, tMenu }),
  );
  const hasEmail = Boolean(borrower?.email?.trim());

  const sendEmail = (): void => {
    startTransition(async () => {
      const res = await sendDocumentRequestAction(caseId);
      if (res.ok) {
        toast.success(t('sent'));
        setEmailOpen(false);
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
      if (res.error !== 'unknown') setEmailOpen(false);
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
            onClick={() => hasEmail && setEmailOpen(true)}
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

      <Dialog open={emailOpen} onOpenChange={setEmailOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-neutral-600">{t('confirm')}</p>
          <DialogFooter>
            <Button
              type="button"
              disabled={isPending}
              onClick={sendEmail}
              className="bg-brand-gold font-semibold text-brand-black hover:bg-brand-gold-hover"
            >
              {isPending ? <Loader2 className="size-4 animate-spin" /> : t('send')}
            </Button>
            <Button type="button" variant="outline" onClick={() => setEmailOpen(false)}>
              {tc('cancel')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

type MenuT = ReturnType<typeof useTranslations>;

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
