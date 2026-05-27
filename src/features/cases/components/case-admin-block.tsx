import Link from 'next/link';

import { Plus, Wallet } from 'lucide-react';
import { getTranslations } from 'next-intl/server';

import { listCaseBanks } from '@/features/case-banks/services/case-banks.service';
import type { CaseBankWithRelations } from '@/features/case-banks/types';
import type { Locale } from '@/lib/i18n/direction';
import { asCaseId } from '@/lib/types/branded';
import { formatDateShort } from '@/lib/utils/format-date';

import { formatMoney } from '../domain/format';
import type { CaseBlocker, InsuranceStatus } from '../schemas/case.schema';

import { CaseBlock } from './case-block';
import { BlockerRow, DataRow, InsuranceRow } from './case-info-rows';

type Props = {
  caseId: string;
  blocker: CaseBlocker | null;
  insurance: InsuranceStatus | null;
  referrerName: string | null;
  advisor: string;
  createdAt: string;
  feeAmount: number | null;
  expectedIncome: number | null;
  canSeeFinancials: boolean;
  locale: Locale;
};

/**
 * Administrative case info block. Manager-only fee/income rows are
 * server-rendered conditionally so they never reach the client when the
 * caller lacks permission (defense-in-depth alongside RLS).
 */
export async function CaseAdminBlock({
  caseId,
  blocker,
  insurance,
  referrerName,
  advisor,
  createdAt,
  feeAmount,
  expectedIncome,
  canSeeFinancials,
  locale,
}: Props) {
  const t = await getTranslations('case');

  // Banks used to live in their own block on the case page; consolidated
  // here as a single row because a typical case has 1-3 banks and the
  // standalone block was visually heavy for a small dataset. Each chip
  // links to the existing per-bank edit page; "+ Add" goes to the
  // existing /banks/new route.
  let banks: CaseBankWithRelations[] = [];
  try {
    banks = await listCaseBanks(asCaseId(caseId));
  } catch (err) {
    console.error('[CaseAdminBlock] banks fetch failed', err);
  }

  return (
    <CaseBlock title={t('blocks.admin')} icon={<Wallet />}>
      <BlockerRow blocker={blocker} />
      <InsuranceRow status={insurance} />
      <DataRow label={t('fields.referrer')} value={referrerName ?? '—'} />
      <DataRow label={t('fields.advisor')} value={advisor} />
      <DataRow
        label={t('fields.createdAt')}
        value={formatDateShort(createdAt, locale)}
      />
      <BanksRow caseId={caseId} banks={banks} addLabel={t('blocks.addBank')} />
      {canSeeFinancials && (
        <>
          <DataRow
            label={t('fields.feeAmount')}
            value={formatMoney(feeAmount)}
            accent="gold"
          />
          <DataRow
            label={t('fields.expectedIncome')}
            value={formatMoney(expectedIncome)}
            accent="gold"
          />
        </>
      )}
    </CaseBlock>
  );
}

/** Inline banks row — replaces the previous standalone block. Each bank
 *  links to its edit page; an empty list shows just the "+ Add" CTA. */
async function BanksRow({
  caseId,
  banks,
  addLabel,
}: {
  caseId: string;
  banks: CaseBankWithRelations[];
  addLabel: string;
}) {
  const t = await getTranslations('case');
  return (
    <div className="flex items-baseline justify-between gap-3 py-2 border-b border-neutral-100">
      <span className="text-sm text-neutral-600">{t('blocks.banks')}</span>
      <div className="flex flex-wrap items-center justify-end gap-1.5 min-w-0">
        {banks.map((cb) => (
          <Link
            key={cb.id}
            href={`/cases/${caseId}/banks/${cb.id}/edit`}
            className="inline-flex items-center gap-1.5 text-xs text-neutral-800 bg-neutral-50 border border-neutral-200 rounded-full px-2 py-0.5 hover:border-brand-gold-text/50 hover:bg-brand-gold/8 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold-text/40"
          >
            {cb.bank?.color && (
              <span
                aria-hidden="true"
                className="size-2 rounded-full shrink-0"
                style={{ backgroundColor: cb.bank.color }}
              />
            )}
            <span className="font-medium">{cb.bank?.name_he ?? '—'}</span>
            {cb.is_primary && (
              <span className="text-[10px] text-brand-gold-text font-bold">
                ★
              </span>
            )}
            {cb.status?.name_he && (
              <span
                aria-hidden="true"
                className="size-1.5 rounded-full shrink-0"
                style={{ backgroundColor: cb.status.color ?? '#999' }}
                title={cb.status.name_he}
              />
            )}
          </Link>
        ))}
        <Link
          href={`/cases/${caseId}/banks/new`}
          className="inline-flex items-center gap-1 text-xs font-medium text-brand-gold-text bg-brand-gold-soft border border-brand-gold/40 rounded-full px-2 py-0.5 hover:bg-brand-gold/20 hover:border-brand-gold/60 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold-text/40"
        >
          <Plus aria-hidden="true" className="size-3" />
          {addLabel}
        </Link>
      </div>
    </div>
  );
}
