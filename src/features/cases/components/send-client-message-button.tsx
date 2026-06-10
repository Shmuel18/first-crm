'use client';

import { FileText, Mail, MessageCircle, MessageSquare } from 'lucide-react';
import { useTranslations } from 'next-intl';

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Tooltip } from '@/components/ui/tooltip';
import { buildMailLink, buildWhatsAppLink } from '@/features/borrowers/domain/contact-links';
import type { RenderedTemplate } from '@/features/templates/types';

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
  /** Active message templates, merge fields already substituted server-side.
   *  Empty array hides the templates section entirely. */
  templates: ReadonlyArray<RenderedTemplate>;
};

/**
 * "Send message to client" — opens a WhatsApp composer (prefilled with a
 * greeting or a chosen template) or the email client (mailto, optionally
 * prefilled from a template) for the primary borrower. Both are client-side
 * links; the advisor reviews and sends from their own app, so there's no
 * backend send to rate-limit.
 */
export function SendClientMessageButton({ title, borrower, templates }: Props) {
  const t = useTranslations('case.actionBar.sendMessageMenu');

  const firstName = borrower?.firstName?.trim() ?? '';
  const greeting = firstName
    ? t('whatsappGreeting', { name: firstName })
    : t('whatsappGreetingNoName');
  const waLink = buildWhatsAppLink(borrower?.phone, greeting);
  const mailLink = buildMailLink(borrower?.email);

  // A template opens through its channel; 'general' templates prefer WhatsApp
  // and fall back to email, so they stay usable with partial contact info.
  const templateLink = (tpl: RenderedTemplate): string | null => {
    const wa = buildWhatsAppLink(borrower?.phone, tpl.body);
    const mail = buildMailLink(borrower?.email, { subject: tpl.subject, body: tpl.body });
    if (tpl.channel === 'whatsapp') return wa;
    if (tpl.channel === 'email') return mail;
    return wa ?? mail;
  };

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
      <DropdownMenuContent align="end" className="w-64">
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

        {templates.length > 0 && (
          <>
            <div className="mt-1 border-t border-neutral-100 px-2 pt-2 pb-1 text-[10px] font-semibold tracking-wide text-neutral-400 uppercase">
              {t('templatesLabel')}
            </div>
            {templates.map((tpl) => {
              const link = templateLink(tpl);
              return (
                <DropdownMenuItem
                  key={tpl.id}
                  disabled={!link}
                  onClick={() => link && window.open(link, '_blank', 'noopener,noreferrer')}
                  className="gap-2"
                >
                  <FileText className="size-4 text-brand-gold-text" aria-hidden="true" />
                  <span className="flex-1 truncate">{tpl.name}</span>
                  {!link && (
                    <span className="text-[10px] text-neutral-500">{t('noContact')}</span>
                  )}
                </DropdownMenuItem>
              );
            })}
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
