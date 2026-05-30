'use client';

import { Mail, MessageCircle, MessageSquare } from 'lucide-react';
import { useTranslations } from 'next-intl';

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Tooltip } from '@/components/ui/tooltip';
import { buildMailLink, buildWhatsAppLink } from '@/features/borrowers/domain/contact-links';

type Props = {
  /** Tooltip / aria-label for the trigger icon. */
  title: string;
  /** Primary borrower contact — gates the menu items and prefills the WhatsApp
   *  greeting. Null (no borrower yet) leaves both channels disabled. */
  borrower: {
    firstName: string | null;
    lastName: string | null;
    email: string | null;
    phone: string | null;
  } | null;
};

/**
 * "Send message to client" — opens a WhatsApp composer (prefilled with a
 * greeting) or the email client (mailto) for the primary borrower. Both are
 * client-side links; the advisor writes the actual message in their own app, so
 * there's no backend send to template or rate-limit. Mirrors the documents
 * page's send-request menu for a consistent affordance.
 */
export function SendClientMessageButton({ title, borrower }: Props) {
  const t = useTranslations('case.actionBar.sendMessageMenu');

  const firstName = borrower?.firstName?.trim() ?? '';
  const greeting = firstName
    ? t('whatsappGreeting', { name: firstName })
    : t('whatsappGreetingNoName');
  const waLink = buildWhatsAppLink(borrower?.phone, greeting);
  const mailLink = buildMailLink(borrower?.email);

  return (
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
      <DropdownMenuContent align="end" className="w-60">
        <DropdownMenuItem
          disabled={!mailLink}
          onClick={() => mailLink && window.open(mailLink)}
          className="gap-2"
        >
          <Mail className="size-4 text-neutral-500" aria-hidden="true" />
          <span className="flex-1">{t('viaEmail')}</span>
          {!mailLink && <span className="text-[10px] text-neutral-500">{t('noEmail')}</span>}
        </DropdownMenuItem>
        <DropdownMenuItem
          disabled={!waLink}
          onClick={() => waLink && window.open(waLink, '_blank', 'noopener,noreferrer')}
          className="gap-2"
        >
          <MessageCircle className="size-4 text-emerald-600" aria-hidden="true" />
          <span className="flex-1">{t('viaWhatsapp')}</span>
          {!waLink && <span className="text-[10px] text-neutral-500">{t('noPhone')}</span>}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
