import { Coins } from 'lucide-react';
import { getLocale, getTranslations } from 'next-intl/server';

import { CaseBlock } from '@/features/cases/components/case-block';
import { userHasPermission } from '@/lib/auth/permissions';
import { parseLocale } from '@/lib/i18n/direction';
import { asCaseId } from '@/lib/types/branded';
import { formatCurrency } from '@/lib/utils/format-currency';

import {
  collectionBalance,
  collectionProgressPct,
  collectionStatus,
  sumCollected,
} from '../domain/collections-calc';
import {
  getCaseAgreedFee,
  listCaseFeePayments,
} from '../services/collections.service';
import { FeePaymentForm } from './fee-payment-form';
import { FeePaymentsTable } from './fee-payments-table';

type Props = { caseId: string };

/**
 * Per-case collection ledger (migration 206). Hidden entirely when the caller
 * lacks `view_collections` — never renders an empty shell. Edit affordances
 * (add form + delete) gate on `manage_collections` so a read-only "ממונה גבייה"
 * sees the history without controls.
 */
export async function CaseCollectionsBlock({ caseId }: Props) {
  const canView = await userHasPermission('view_collections');
  if (!canView) return null;

  const id = asCaseId(caseId);
  const [canManage, payments, feeAmount, t, locale] = await Promise.all([
    userHasPermission('manage_collections'),
    listCaseFeePayments(id),
    getCaseAgreedFee(id),
    getTranslations('collections'),
    getLocale().then(parseLocale),
  ]);

  const collected = sumCollected(payments.map((p) => p.amount));
  const status = collectionStatus(feeAmount, collected);
  const balance = collectionBalance(feeAmount, collected);
  const pct = collectionProgressPct(feeAmount, collected);
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jerusalem' }).format(new Date());

  return (
    <CaseBlock
      title={t('block.title')}
      icon={<Coins />}
      fullWidth
      rightSlot={
        <span className="text-xs text-neutral-600 tabular-nums">
          {t('block.collectedShort')}: {formatCurrency(collected, locale)}
        </span>
      }
    >
      <div className="space-y-4">
        {/* Summary: collected / agreed fee / balance + progress bar. The bar
            only appears when an agreed fee is known (manager / view_case_fee). */}
        <div className="rounded-xl border border-neutral-200 bg-brand-gold-soft p-4">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <Stat label={t('block.collected')} value={formatCurrency(collected, locale)} />
            {feeAmount != null && (
              <Stat label={t('block.agreedFee')} value={formatCurrency(feeAmount, locale)} />
            )}
            {feeAmount != null && (
              <Stat
                label={t('block.balance')}
                value={formatCurrency(Math.max(0, balance), locale)}
                accent={status !== 'collected' && status !== 'overpaid'}
              />
            )}
          </div>
          {feeAmount != null && (
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-neutral-100">
              <div
                className={`h-full rounded-full ${
                  status === 'collected' || status === 'overpaid'
                    ? 'bg-emerald-500'
                    : 'bg-brand-gold'
                }`}
                style={{ width: `${pct}%` }}
              />
            </div>
          )}
          <p className="mt-2 text-xs font-medium text-neutral-600">{t(`status.${status}`)}</p>
        </div>

        {canManage && <FeePaymentForm caseId={caseId} defaultDate={today} />}

        <FeePaymentsTable caseId={caseId} payments={payments} locale={locale} canManage={canManage} />
      </div>
    </CaseBlock>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div>
      <div className="text-xs text-neutral-500">{label}</div>
      <div
        className={`mt-0.5 font-display text-lg font-semibold tabular-nums ${
          accent ? 'text-brand-gold-text' : 'text-neutral-950'
        }`}
      >
        {value}
      </div>
    </div>
  );
}
