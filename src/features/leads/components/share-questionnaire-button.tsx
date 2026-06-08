'use client';

import { Copy, MessageCircle, Send } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

/**
 * The public /check questionnaire link, resolved against the current origin so
 * it works on whatever domain the CRM is served from (no hard-coded host).
 */
function questionnaireLink(): string {
  if (typeof window === 'undefined') return '/check';
  return `${window.location.origin}/check`;
}

/** Lets an advisor send a prospect the public questionnaire link (WhatsApp / copy). */
export function ShareQuestionnaireButton() {
  const t = useTranslations('leads.share');

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(questionnaireLink());
      toast.success(t('copied'));
    } catch {
      toast.error(t('copyFailed'));
    }
  };

  const shareWhatsApp = () => {
    const text = `${t('waMessage')} ${questionnaireLink()}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank', 'noopener,noreferrer');
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <button
            type="button"
            className="inline-flex h-9 items-center gap-2 rounded-lg border border-brand-gold/40 px-4 text-sm font-medium text-brand-gold-text transition hover:bg-brand-gold-soft"
          />
        }
      >
        <Send className="size-4" aria-hidden="true" />
        {t('button')}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuItem onClick={shareWhatsApp} className="gap-2">
          <MessageCircle className="size-4" aria-hidden="true" />
          {t('whatsapp')}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => void copyLink()} className="gap-2">
          <Copy className="size-4" aria-hidden="true" />
          {t('copy')}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
