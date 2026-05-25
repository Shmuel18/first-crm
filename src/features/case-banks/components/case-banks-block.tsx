import Link from 'next/link';

import { Building2 } from 'lucide-react';
import { getTranslations } from 'next-intl/server';

import { CaseBlock } from '@/features/cases/components/case-block';
import { asCaseId } from '@/lib/types/branded';

import { listCaseBanks } from '../services/case-banks.service';

import { CaseBankRow } from './case-bank-row';

type Props = { caseId: string };

/**
 * Self-fetching block for banks on a case. Suspended at the page level so
 * the case header doesn't wait on the banks query.
 */
export async function CaseBanksBlock({ caseId }: Props) {
  const t = await getTranslations('case');
  const banks = await listCaseBanks(asCaseId(caseId));

  return (
    <CaseBlock
      title={`${t('blocks.banks')} ${banks.length > 0 ? `(${banks.length})` : ''}`}
      icon={<Building2 />}
      rightSlot={
        <Link
          href={`/cases/${caseId}/banks/new`}
          className="text-xs text-brand-gold-text hover:underline font-medium rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold-text/40"
        >
          {t('blocks.addBank')}
        </Link>
      }
    >
      {banks.length === 0 ? (
        <p className="text-sm text-neutral-600 text-center py-6">{t('blocks.noBanks')}</p>
      ) : (
        <div className="space-y-2">
          {banks.map((cb) => (
            <CaseBankRow key={cb.id} caseId={caseId} caseBank={cb} />
          ))}
        </div>
      )}
    </CaseBlock>
  );
}

export async function CaseBanksBlockSkeleton() {
  const t = await getTranslations('case');
  return (
    <CaseBlock title={t('blocks.banks')} icon={<Building2 />}>
      <div className="space-y-2 animate-pulse" aria-hidden>
        <div className="h-12 rounded-lg bg-neutral-100" />
        <div className="h-12 rounded-lg bg-neutral-100" />
      </div>
    </CaseBlock>
  );
}
