import Link from 'next/link';
import { notFound } from 'next/navigation';

import { ArrowRight } from 'lucide-react';
import { getTranslations } from 'next-intl/server';

import { CaseBankForm } from '@/features/case-banks/components/case-bank-form';
import {
  getCaseBankById,
  listBankOptions,
  listCaseBankStatusOptions,
} from '@/features/case-banks/services/case-banks.service';
import { getRawCaseById } from '@/features/cases/services/cases.service';
import { asCaseBankId, asCaseId } from '@/lib/types/branded';

type Props = { params: Promise<{ id: string; bankId: string }> };

export default async function EditCaseBankPage({ params }: Props) {
  const { id, bankId } = await params;

  const [caseData, caseBank] = await Promise.all([
    getRawCaseById(asCaseId(id)),
    getCaseBankById(asCaseBankId(bankId)),
  ]);

  if (!caseData || !caseBank || caseBank.case_id !== id) notFound();

  const t = await getTranslations('case');
  const tc = await getTranslations('common');

  const [banks, statuses] = await Promise.all([
    listBankOptions(),
    listCaseBankStatusOptions(),
  ]);

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <Link
          href={`/cases/${id}`}
          className="inline-flex items-center gap-1 text-sm text-neutral-500 hover:text-neutral-900 mb-3"
        >
          <ArrowRight className="size-4" />
          {tc('back')}
        </Link>
        <h1 className="text-2xl font-light text-neutral-900 font-mono">
          {tc('edit')} · {t('blocks.banks')} · {t('actionBar.caseLabel')} {caseData.case_number}
        </h1>
      </div>

      <div className="bg-white border border-neutral-200 rounded-lg p-6">
        <CaseBankForm
          caseId={id}
          initial={caseBank}
          banks={banks}
          statuses={statuses}
        />
      </div>
    </div>
  );
}
