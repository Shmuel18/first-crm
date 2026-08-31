'use client';

import { useState } from 'react';

import { Loader2, Send } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { callAction } from '@/lib/actions/call-action';
import { formatCurrency } from '@/lib/utils/format-currency';
import { cn } from '@/lib/utils';
import type { Locale } from '@/lib/i18n/direction';

import { sendAgreementAction } from '../actions/send-agreement';
import { estimatedBalance, estimatedFee } from '../domain/agreement-calc';

import type { AgreementLanguage } from '../domain/agreement-text';

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  caseId: string;
  defaultEmail: string;
  defaultFeePercent: number | null;
  defaultFeeAdvance: number | null;
  /** cases.requested_mortgage_amount — the basis for the printed estimate. */
  loanAmount: number | null;
  locale: Locale;
  onSent: (email: string, language: AgreementLanguage) => void;
};

const LANGUAGES: AgreementLanguage[] = ['he', 'en'];

/**
 * Send-for-signature dialog: language, the agreed percentage and the advance.
 * The shekel figures are shown as a live preview of what the client will read
 * — the percentage is the term that actually binds, so the preview is labelled
 * as an estimate and disappears when the case has no loan amount on file.
 *
 * Controlled inputs, re-seeded on open (render-phase reset — the
 * shared-dialog-goes-stale rule).
 */
export function SendAgreementDialog({
  open,
  onOpenChange,
  caseId,
  defaultEmail,
  defaultFeePercent,
  defaultFeeAdvance,
  loanAmount,
  locale,
  onSent,
}: Props) {
  const t = useTranslations('agreements.dialog');
  const [language, setLanguage] = useState<AgreementLanguage>('he');
  const [feePercent, setFeePercent] = useState('');
  const [feeAdvance, setFeeAdvance] = useState('');
  const [email, setEmail] = useState('');
  const [pending, setPending] = useState(false);
  const [seeded, setSeeded] = useState(false);

  // Re-seed drafts each time the dialog opens (render-phase, not effect).
  if (open && !seeded) {
    setSeeded(true);
    setLanguage('he');
    setFeePercent(defaultFeePercent != null ? String(defaultFeePercent) : '');
    setFeeAdvance(defaultFeeAdvance != null ? String(defaultFeeAdvance) : '');
    setEmail(defaultEmail);
  } else if (!open && seeded) {
    setSeeded(false);
  }

  const percent = Number(feePercent) || 0;
  const advance = Number(feeAdvance) || 0;
  const estimate = estimatedFee(loanAmount, percent);
  const balance = estimatedBalance(estimate, advance);
  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  const valid = emailValid && percent > 0 && percent <= 100 && advance >= 0;

  const send = async (): Promise<void> => {
    if (!valid || pending) return;
    setPending(true);
    const res = await callAction(() =>
      sendAgreementAction({
        caseId,
        language,
        feePercent: percent,
        feeAdvance: advance,
        clientEmail: email.trim(),
      }),
    );
    setPending(false);
    if (!res.ok) {
      toast.error(t(`errors.${res.error}`));
      return;
    }
    if (res.emailStatus === 'sent') toast.success(t('emailSent'));
    // The link exists but nothing reached the client — say so honestly.
    else toast.warning(t('emailNotDelivered'));
    onSent(email.trim(), language);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('title')}</DialogTitle>
          <DialogDescription>{t('description')}</DialogDescription>
        </DialogHeader>

        <div className="grid gap-4">
          <div className="grid gap-1.5">
            <Label>{t('language')}</Label>
            <div className="flex overflow-hidden rounded-lg border border-neutral-200">
              {LANGUAGES.map((l) => (
                <button
                  key={l}
                  type="button"
                  onClick={() => setLanguage(l)}
                  className={cn(
                    'flex-1 px-3 py-2 text-sm font-medium transition',
                    language === l
                      ? 'bg-brand-gold text-brand-black'
                      : 'bg-white text-neutral-600 hover:bg-neutral-50',
                  )}
                >
                  {t(`languages.${l}`)}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor={`agr-pct-${caseId}`}>{t('feePercent')}</Label>
              <Input
                id={`agr-pct-${caseId}`}
                type="number"
                min="0"
                max="100"
                step="0.1"
                dir="ltr"
                value={feePercent}
                onChange={(e) => setFeePercent(e.target.value)}
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor={`agr-adv-${caseId}`}>{t('feeAdvance')}</Label>
              <Input
                id={`agr-adv-${caseId}`}
                type="number"
                min="0"
                step="100"
                dir="ltr"
                value={feeAdvance}
                onChange={(e) => setFeeAdvance(e.target.value)}
              />
            </div>
          </div>

          <div className="rounded-lg bg-brand-gold-soft px-3 py-2.5 text-sm">
            {estimate === null ? (
              <p className="text-neutral-600">{t('noLoanAmount')}</p>
            ) : (
              <>
                <p className="text-neutral-700">
                  {t('estimateBasis', { loan: formatCurrency(loanAmount, locale) })}
                </p>
                <p className="mt-1 text-neutral-900">
                  {t('estimateFee')}:{' '}
                  <span className="font-semibold tabular-nums">
                    {formatCurrency(estimate, locale)}
                  </span>
                  {balance !== null && (
                    <>
                      {' · '}
                      {t('estimateBalance')}:{' '}
                      <span className="font-semibold tabular-nums">
                        {formatCurrency(balance, locale)}
                      </span>
                    </>
                  )}
                </p>
              </>
            )}
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor={`agr-email-${caseId}`}>{t('clientEmail')}</Label>
            <Input
              id={`agr-email-${caseId}`}
              type="email"
              dir="ltr"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
        </div>

        <DialogFooter>
          <button
            type="button"
            onClick={() => void send()}
            disabled={!valid || pending}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-brand-gold px-4 py-2 text-sm font-bold text-brand-black transition hover:bg-brand-gold-hover disabled:cursor-not-allowed disabled:opacity-50"
          >
            {pending ? (
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            ) : (
              <Send className="size-4" aria-hidden="true" />
            )}
            {pending ? t('sending') : t('send')}
          </button>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="rounded-lg border border-neutral-200 px-4 py-2 text-sm font-medium text-neutral-700 transition hover:bg-neutral-50"
          >
            {t('cancel')}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
