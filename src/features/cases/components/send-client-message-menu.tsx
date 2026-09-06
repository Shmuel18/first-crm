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
import type { RenderedTemplate } from '@/features/templates/types';

type Props = {
  title: string;
  /** At least one borrower on the case has an address. */
  hasEmail: boolean;
  /** A phone is on file (the wa.me link could be built). */
  hasPhone: boolean;
  templates: ReadonlyArray<RenderedTemplate>;
  onEmail: () => void;
  onWhatsApp: () => void;
  onTemplate: (template: RenderedTemplate) => void;
};

/**
 * The channel menu behind the case action bar's speech-bubble icon: email,
 * WhatsApp, and the office's templates. Each item is disabled when the matching
 * contact detail is missing; the parent owns every draft and dialog.
 */
export function SendClientMessageMenu({
  title,
  hasEmail,
  hasPhone,
  templates,
  onEmail,
  onWhatsApp,
  onTemplate,
}: Props) {
  const t = useTranslations('case.actionBar.sendMessageMenu');

  return (
    <DropdownMenu>
      <Tooltip content={title}>
        <DropdownMenuTrigger
          render={
            <button
              type="button"
              aria-label={title}
              className="tap-target relative flex size-8 items-center justify-center rounded-md text-neutral-600 transition hover:bg-white hover:text-brand-gold-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold-text/50"
            />
          }
        >
          <MessageSquare className="size-3.5" aria-hidden="true" />
        </DropdownMenuTrigger>
      </Tooltip>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuItem disabled={!hasEmail} onClick={() => hasEmail && onEmail()} className="gap-2">
          <Mail className="size-4 text-neutral-500" aria-hidden="true" />
          <span className="flex-1">{t('viaEmail')}</span>
          {!hasEmail && <span className="text-[10px] text-neutral-500">{t('noEmail')}</span>}
        </DropdownMenuItem>
        <DropdownMenuItem disabled={!hasPhone} onClick={onWhatsApp} className="gap-2">
          <MessageCircle className="size-4 text-emerald-600" aria-hidden="true" />
          <span className="flex-1">{t('viaWhatsapp')}</span>
          {!hasPhone && <span className="text-[10px] text-neutral-500">{t('noPhone')}</span>}
        </DropdownMenuItem>

        {templates.length > 0 && (
          <>
            <div className="mt-1 border-t border-neutral-100 px-2 pt-2 pb-1 text-[10px] font-semibold tracking-wide text-neutral-400 uppercase">
              {t('templatesLabel')}
            </div>
            {templates.map((tpl) => {
              const usable = tpl.channel === 'email' ? hasEmail : hasPhone || hasEmail;
              return (
                <DropdownMenuItem
                  key={tpl.id}
                  disabled={!usable}
                  onClick={() => usable && onTemplate(tpl)}
                  className="gap-2"
                >
                  <FileText className="size-4 text-brand-gold-text" aria-hidden="true" />
                  <span className="flex-1 truncate">{tpl.name}</span>
                  {!usable && <span className="text-[10px] text-neutral-500">{t('noContact')}</span>}
                </DropdownMenuItem>
              );
            })}
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
