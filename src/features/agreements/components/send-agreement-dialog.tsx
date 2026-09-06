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
import { estimatedBalance, estimatedFee, type AgreementFeeTerms } from '../domain/agreement-calc';

import type { AgreementLanguage } from '../domain/agreement-text';

type FeeBasis = AgreementFeeTerms['basis'];

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  caseId: string;
  defaultEmail: string;
  /** Terms of the last agreement on this case, so a re-send repeats them. */
  defaultFee: AgreementFeeTerms | null;
  defaultFeeAdvance: number | null;
  /** cases.requested_mortgage_amount — the basis for the printed estimate. */
  loanAmount: number | null;
  locale: Locale;
  onSent: (email: string, language: AgreementLanguage) => void;
};

const LANGUAGES: AgreementLanguage[] = ['he', 'en'];
const BASES: FeeBasis[] = ['percent', 'fixed'];

/**
 * Send-for-signature dialog: language, how the fee was agreed, and the advance.
 *
 * A percentage deal bills on the loan actually advanced, so its shekel figures
 * are shown as a live estimate. A fixed fee is the agreed sum itself and does
 * not move with the loan, so nothing about it is presented as an estimate.
 *
 * Controlled inputs, re-seeded on open (render-phase reset — the
 * shared-dialog-goes-stale rule).
 */
export function SendAgreementDialog({
  open,
  onOpenChange,
  caseId,
  defaultEmail,
  defaultFee,
  defaultFeeAdvance,
  loanAmount,
  locale,
  onSent,
}: Props) {
  const t = useTranslations('agreements.dialog');
  const [language, setLanguage] = useState<AgreementLanguage>('he');
  const [basis, setBasis] = useState<FeeBasis>('percent');
  const [feePercent, setFeePercent] = useState('');
  const [feeAmount, setFeeAmount] = useState('');
  const [feeAdvance, setFeeAdvance] = useState('');
  const [email, setEmail] = useState('');
  const [pending, setPending] = useState(false);
  const [seeded, setSeeded] = useState(false);

  // Re-seed drafts each time the dialog opens (render-phase, not effect).
  if (open && !seeded) {
    setSeeded(true);
    setLanguage('he');
    setBasis(defaultFee?.basis ?? 'percent');
    setFeePercent(defaultFee?.basis === 'percent' ? String(defaultFee.feePercent) : '');
    setFeeAmount(defaultFee?.basis === 'fixed' ? String(defaultFee.feeAmount) : '');
    setFeeAdvance(defaultFeeAdvance != null ? String(defaultFeeAdvance) : '');
    setEmail(defaultEmail);
  } else if (!open && seeded) {
    setSeeded(false);
  }

  const percent = Number(feePercent) || 0;
  const amount = Number(feeAmount) || 0;
  const advance = Number(feeAdvance) || 0;
  const isPercent = basis === 'percent';
  // What the client will read as the fee: an estimate on a percentage deal,
  // the agreed sum on a fixed one.
  const printedFee = isPercent ? estimatedFee(loanAmount, percent) : amount || null;
  const balance = estimatedBalance(printedFee, advance);
  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  const feeValid = isPercent ? percent > 0 && percent <= 100 : amount > 0 && advance <= amount;
  const valid = emailValid && feeValid && advance >= 0;

  const send = async (): Promise<void> => {
    if (!valid || pending) return;
    setPending(true);
    const res = await callAction(() =>
      sendAgreementAction({
        caseId,
        language,
        feeAdvance: advance,
        clientEmail: email.trim(),
        ...(isPercent
          ? { feeBasis: 'percent' as const, feePercent: percent }
          : { feeBasis: 'fixed' as const, feeAmount: amount }),
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
            <SegmentedControl
              options={LANGUAGES.map((l) => ({ value: l, label: t(`languages.${l}`) }))}
              value={language}
              onChange={setLanguage}
            />
          </div>

          <div className="grid gap-1.5">
            <Label>{t('feeBasis')}</Label>
            <SegmentedControl
              options={BASES.map((b) => ({ value: b, label: t(`feeBases.${b}`) }))}
              value={basis}
              onChange={setBasis}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor={`agr-fee-${caseId}`}>
                {isPercent ? t('feePercent') : t('feeAmount')}
              </Label>
              <Input
                id={`agr-fee-${caseId}`}
                type="number"
                min="0"
                max={isPercent ? '100' : undefined}
                step={isPercent ? '0.1' : '100'}
                dir="ltr"
                value={isPercent ? feePercent : feeAmount}
                onChange={(e) =>
                  isPercent ? setFeePercent(e.target.value) : setFeeAmount(e.target.value)
                }
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

          <div className="bg-brand-gold-soft rounded-lg px-3 py-2.5 text-sm">
            {printedFee === null ? (
              <p className="text-neutral-600">{t('noLoanAmount')}</p>
            ) : (
              <>
                {isPercent && (
                  <p className="text-neutral-700">
                    {t('estimateBasis', { loan: formatCurrency(loanAmount, locale) })}
                  </p>
                )}
                <p className="mt-1 text-neutral-900">
                  {isPercent ? t('estimateFee') : t('agreedFee')}:{' '}
                  <span className="font-semibold tabular-nums">
                    {formatCurrency(printedFee, locale)}
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
            className="bg-brand-gold text-brand-black hover:bg-brand-gold-hover inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-bold transition disabled:cursor-not-allowed disabled:opacity-50"
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

/** Two-or-more mutually exclusive choices, styled as one segmented bar. */
function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
}: {
  options: ReadonlyArray<{ value: T; label: string }>;
  value: T;
  onChange: (next: T) => void;
}) {
  return (
    <div className="flex overflow-hidden rounded-lg border border-neutral-200">
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          aria-pressed={value === opt.value}
          onClick={() => onChange(opt.value)}
          className={cn(
            'flex-1 px-3 py-2 text-sm font-medium transition',
            value === opt.value
              ? 'bg-brand-gold text-brand-black'
              : 'bg-white text-neutral-600 hover:bg-neutral-50',
          )}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
