import Link from 'next/link';

import { getTranslations } from 'next-intl/server';

import { CaseStatusBadge } from '@/features/cases/components/case-status-badge';

import type { CaseBankWithRelations } from '../types';

type Props = {
  caseId: string;
  caseBank: CaseBankWithRelations;
};

export async function CaseBankRow({ caseId, caseBank: cb }: Props) {
  const t = await getTranslations('case.fields');

  return (
    <Link
      href={`/cases/${caseId}/banks/${cb.id}/edit`}
      className="flex items-center justify-between gap-3 p-3 border border-neutral-200 rounded-lg hover:border-brand-gold-text/40 hover:bg-brand-gold/8 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-gold-text/50 transition"
    >
      <div className="flex items-center gap-3 flex-1">
        {cb.bank?.color && (
          <span
            aria-hidden="true"
            className="size-3 rounded-full shrink-0"
            style={{ backgroundColor: cb.bank.color }}
          />
        )}
        <span className="font-medium text-sm text-neutral-900">
          {cb.bank?.name_he ?? '—'}
        </span>
        {cb.is_primary && (
          <span className="text-[10px] text-brand-gold-text font-bold">
            {t('primaryBankMarker')}
          </span>
        )}
        {cb.banker_name && (
          <span aria-hidden="true" className="text-xs text-neutral-600">
            · {cb.banker_name}
          </span>
        )}
      </div>
      <CaseStatusBadge name={cb.status?.name_he ?? null} color={cb.status?.color ?? null} />
    </Link>
  );
}
