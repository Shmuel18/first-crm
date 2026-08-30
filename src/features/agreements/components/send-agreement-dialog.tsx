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
import type { Locale } from '@/lib/i18n/direction';

import { sendAgreementAction } from '../actions/send-agreement';

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  caseId: string;
  defaultEmail: string;
  defaultFeeTotal: number | null;
  defaultFeeAdvance: number | null;
  locale: Locale;
  onSent: (email: string, feeTotal: number, feeAdvance: number) => void;
};

/**
 * Manager's send-for-signature dialog: total fee + advance (prefilled from
 * the מנהלה numbers), the derived balance-at-execution, and the client's
 * email. Controlled inputs, re-seeded on open (render-phase reset — the
 * shared-dialog-goes-stale rule).
 */
export function SendAgreementDialog({
  open,
  onOpenChange,
  caseId,
  defaultEmail,
  defaultFeeTotal,
  defaultFeeAdvance,
  locale,
  onSent,
}: Props) {
  const t = useTranslations('agreements.dialog');
  const [feeTotal, setFeeTotal] = useState('');
  const [feeAdvance, setFeeAdvance] = useState('');
  const [email, setEmail] = useState('');
  const [pending, setPending] = useState(false);
  const [seededFor, setSeededFor] = useState(false);

  // Re-seed drafts each time the dialog opens (render-phase, not effect).
  if (open && !seededFor) {
    setSeededFor(true);
    setFeeTotal(defaultFeeTotal != null ? String(defaultFeeTotal) : '');
    setFeeAdvance(defaultFeeAdvance != null ? String(defaultFeeAdvance) : '');
    setEmail(defaultEmail);
  } else if (!open && seededFor) {
    setSeededFor(false);
  }

  const total = Number(feeTotal) || 0;
  const advance = Number(feeAdvance) || 0;
  const balance = Math.max(0, total - advance);
  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  const valid = emailValid && total > 0 && advance >= 0 && advance <= total;

  const send = async (): Promise<void> => {
    if (!valid || pending) return;
    setPending(true);
    const res = await callAction(() =>
      sendAgreementAction({
        caseId,
        feeTotal: total,
        feeAdvance: advance,
        clientEmail: email.trim(),
      }),
    );
    setPending(false);
    if (!res.ok) {
      toast.error(t(`errors.${res.error}`));
      return;
    }
    if (res.emailStatus === 'sent') {
      toast.success(t('emailSent'));
    } else {
      // The link exists but nothing reached the client — say so honestly.
      toast.warning(t('emailNotDelivered'));
    }
    onSent(email.trim(), total, advance);
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
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor={`agr-fee-${caseId}`}>{t('feeTotal')}</Label>
              <Input
                id={`agr-fee-${caseId}`}
                type="number"
                min="0"
                step="100"
                dir="ltr"
                value={feeTotal}
                onChange={(e) => setFeeTotal(e.target.value)}
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
          <p className="text-sm text-neutral-600">
            {t('feeBalance')}:{' '}
            <span className="font-semibold text-neutral-900 tabular-nums">
              {formatCurrency(balance, locale)}
            </span>
          </p>
          {advance > total && (
            <p className="text-xs font-medium text-red-600">{t('validation.advance')}</p>
          )}
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
