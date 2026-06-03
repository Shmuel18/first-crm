'use client';

import { useState } from 'react';

import { Check, Copy } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

type Props = {
  /** The freshly-issued link; the dialog is open while this is non-null. */
  link: string | null;
  onClose: () => void;
};

/**
 * Shows a re-issued invite / set-password link for manual sharing (when email
 * isn't configured). Mirrors the invite dialog's success box; reuses the same
 * i18n strings.
 */
export function ResendLinkDialog({ link, onClose }: Props) {
  const t = useTranslations('team');
  const ti = useTranslations('team.invite');
  const tc = useTranslations('common');
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    if (!link) return;
    await navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Dialog
      open={link !== null}
      onOpenChange={(o) => {
        if (!o) onClose();
      }}
    >
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{t('resend.title')}</DialogTitle>
        </DialogHeader>

        {link && (
          <div
            role="region"
            aria-label={ti('inviteLinkLabel')}
            className="rounded-lg border border-brand-gold/40 bg-brand-gold-soft p-3 space-y-2"
          >
            <p id="resend-link-label" className="text-xs text-neutral-700">
              {ti('inviteLinkLabel')}
            </p>
            <div className="flex items-center justify-between gap-3">
              <code
                aria-labelledby="resend-link-label"
                className="text-xs font-mono text-neutral-900 break-all"
                dir="ltr"
              >
                {link}
              </code>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={copy}
                aria-label={copied ? tc('copied') : tc('copy')}
                className="shrink-0"
              >
                {copied ? (
                  <Check className="size-3.5" aria-hidden="true" />
                ) : (
                  <Copy className="size-3.5" aria-hidden="true" />
                )}
                {copied ? tc('copied') : tc('copy')}
              </Button>
            </div>
            <p className="text-xs text-amber-800">{ti('inviteLinkWarning')}</p>
          </div>
        )}

        <DialogFooter>
          <Button
            type="button"
            onClick={onClose}
            className="bg-brand-gold hover:bg-brand-gold-hover text-brand-black font-semibold"
          >
            {tc('done')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
