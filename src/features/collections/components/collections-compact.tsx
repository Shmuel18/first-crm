'use client';

import { useState, useTransition } from 'react';

import { ChevronDown, Plus } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';

import { formatCurrency } from '@/lib/utils/format-currency';
import type { Locale } from '@/lib/i18n/direction';

import { deleteFeePaymentAction } from '../actions/delete-fee-payment';
import { setAdvanceAmountAction } from '../actions/set-advance-amount';
import {
  collectionBalance,
  collectionProgressPct,
  collectionStatus,
  sumCollected,
} from '../domain/collections-calc';
import type { FeePayment } from '../types';
import { FeePaymentForm } from './fee-payment-form';
import { FeePaymentsTable } from './fee-payments-table';

type Props = {
  caseId: string;
  payments: FeePayment[];
  feeAmount: number | null;
  advanceAmount: number | null;
  canManage: boolean;
  defaultDate: string;
  locale: Locale;
};

/**
 * Compact collections view folded INTO the admin (מנהלה) block — one summary
 * line (collected / balance + a thin progress bar) that expands to the full
 * add-form + ledger on click. Collapsed by default so it never dominates the
 * block; the full management surface also lives on the central /collections.
 *
 * Owns the ledger in local state so add/delete update in place — the server
 * actions deliberately do NOT revalidate /cases/[id] (that re-renders the heavy
 * case page and scroll-jumps to the top).
 */
export function CollectionsCompact({
  caseId,
  payments: initialPayments,
  feeAmount,
  advanceAmount: initialAdvanceAmount,
  canManage,
  defaultDate,
  locale,
}: Props) {
  const t = useTranslations('collections');
  const [open, setOpen] = useState(false);
  const [payments, setPayments] = useState(initialPayments);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  // Local draft for the advance amount input (string so the field stays editable)
  const [advanceDraft, setAdvanceDraft] = useState(
    initialAdvanceAmount != null ? String(initialAdvanceAmount) : '',
  );
  const [, startTransition] = useTransition();

  // Re-sync if the server sends a fresh ledger (navigation / external revalidate).
  // Self-triggered re-renders keep the same prop reference, so optimistic state survives.
  const [seededFrom, setSeededFrom] = useState(initialPayments);
  if (initialPayments !== seededFrom) {
    setSeededFrom(initialPayments);
    setPayments(initialPayments);
  }

  const collected = sumCollected(payments.map((p) => p.amount));
  const balance = collectionBalance(feeAmount, collected);
  const pct = collectionProgressPct(feeAmount, collected);
  const status = collectionStatus(feeAmount, collected);
  const met = status === 'collected' || status === 'overpaid';

  const handleAdvanceBlur = () => {
    const trimmed = advanceDraft.trim();
    const parsed = trimmed === '' ? null : Number(trimmed);
    if (parsed !== null && (!Number.isFinite(parsed) || parsed < 0)) return;
    startTransition(async () => {
      await setAdvanceAmountAction(caseId, parsed);
    });
  };

  const handleDelete = (id: string) => {
    const prev = payments;
    setPayments((list) => list.filter((p) => p.id !== id));
    setDeletingId(id);
    startTransition(async () => {
      try {
        const res = await deleteFeePaymentAction(caseId, id);
        if (!res.ok) {
          setPayments(prev);
          toast.error(t(`table.errors.${res.error}`));
        }
      } catch {
        setPayments(prev);
        toast.error(t('table.errors.unknown'));
      } finally {
        setDeletingId(null);
      }
    });
  };

  return (
    <div className="rounded-lg border border-neutral-200 bg-white">
      <div className="flex items-center gap-2 px-3 py-2">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          className="flex min-w-0 flex-1 items-center gap-3 text-start"
        >
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5 text-sm">
              <span className="text-neutral-500">{t('block.collected')}:</span>
              <span className="font-semibold text-neutral-900 tabular-nums">
                {formatCurrency(collected, locale)}
              </span>
              {feeAmount != null && (
                <>
                  <span className="text-neutral-300" aria-hidden="true">
                    ·
                  </span>
                  <span className="text-neutral-500">{t('block.balance')}:</span>
                  <span
                    className={`font-semibold tabular-nums ${met ? 'text-emerald-600' : 'text-brand-gold-text'}`}
                  >
                    {formatCurrency(Math.max(0, balance), locale)}
                  </span>
                </>
              )}
              {payments.length > 0 && (
                <span className="text-xs text-neutral-400">
                  ({t('block.paymentsCount', { count: payments.length })})
                </span>
              )}
            </div>
            {feeAmount != null && (
              <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-neutral-100">
                <div
                  className={`h-full rounded-full ${met ? 'bg-emerald-500' : 'bg-brand-gold'}`}
                  style={{ width: `${pct}%` }}
                />
              </div>
            )}
          </div>
          <ChevronDown
            className={`size-4 shrink-0 text-neutral-400 transition ${open ? 'rotate-180' : ''}`}
            aria-hidden="true"
          />
        </button>
        {canManage && !open && (
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="inline-flex shrink-0 items-center gap-1 rounded-md border border-brand-gold/50 px-2 py-1 text-xs font-medium text-brand-gold-text transition hover:bg-brand-gold-soft"
          >
            <Plus className="size-3.5" aria-hidden="true" />
            {t('block.add')}
          </button>
        )}
      </div>

      {/* Advance amount — visible collapsed too so it's easy to set */}
      <div className="flex items-center gap-2 border-t border-neutral-100 px-3 py-2">
        <label
          htmlFor={`advance-amount-${caseId}`}
          className="shrink-0 text-xs text-neutral-500 select-none"
        >
          {t('block.advanceAmount')}
        </label>
        <div className="flex items-center gap-1">
          <span className="text-xs text-neutral-400">₪</span>
          <input
            id={`advance-amount-${caseId}`}
            type="number"
            min="0"
            step="100"
            value={advanceDraft}
            onChange={(e) => canManage && setAdvanceDraft(e.target.value)}
            onBlur={handleAdvanceBlur}
            onKeyDown={(e) => e.key === 'Enter' && (e.currentTarget as HTMLInputElement).blur()}
            disabled={!canManage}
            placeholder="—"
            className="w-24 rounded border border-neutral-200 px-1.5 py-0.5 text-xs tabular-nums text-neutral-900 focus:border-brand-gold-text focus:outline-none focus:ring-1 focus:ring-brand-gold-text/30 disabled:opacity-50"
          />
        </div>
      </div>

      {open && (
        <div className="space-y-3 border-t border-neutral-100 p-3">
          {canManage && (
            <FeePaymentForm
              caseId={caseId}
              defaultDate={defaultDate}
              onAdded={(p) => setPayments((list) => [p, ...list])}
            />
          )}
          <FeePaymentsTable
            payments={payments}
            locale={locale}
            canManage={canManage}
            onDelete={handleDelete}
            deletingId={deletingId}
          />
        </div>
      )}
    </div>
  );
}
