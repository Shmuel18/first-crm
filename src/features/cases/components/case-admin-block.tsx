import { Wallet } from 'lucide-react';
import { getTranslations } from 'next-intl/server';

import type { Locale } from '@/lib/i18n/direction';

import { formatMoney } from '../domain/format';
import type { CaseBlocker, InsuranceStatus } from '../schemas/case.schema';

import { CaseBlock } from './case-block';
import { BlockerRow, DataRow, InsuranceRow } from './case-info-rows';

type Props = {
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
  const dateLocale = locale === 'he' ? 'he-IL' : 'en-GB';

  return (
    <CaseBlock title={t('blocks.admin')} icon={<Wallet />}>
      <BlockerRow blocker={blocker} />
      <InsuranceRow status={insurance} />
      <DataRow label={t('fields.referrer')} value={referrerName ?? '—'} />
      <DataRow label={t('fields.advisor')} value={advisor} />
      <DataRow
        label={t('fields.createdAt')}
        value={new Date(createdAt).toLocaleDateString(dateLocale)}
      />
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
