import Link from 'next/link';
import { notFound } from 'next/navigation';

import { getLocale, getTranslations } from 'next-intl/server';

import { BackArrow } from '@/components/shared/back-arrow';
import { CaseForm } from '@/features/cases/components/case-form';
import {
  getCaseFinancials,
  listAdvisorOptions,
  listCaseStatusOptions,
  listCaseTypeOptions,
} from '@/features/cases/services/case-lookups.service';
import { getRawCaseById } from '@/features/cases/services/cases.service';
import { isCurrentUserAdmin } from '@/lib/auth/permissions';
import { parseLocale } from '@/lib/i18n/direction';
import { asCaseId } from '@/lib/types/branded';

type Props = { params: Promise<{ id: string }> };

export default async function EditCasePage({ params }: Props) {
  const { id } = await params;
  const caseData = await getRawCaseById(asCaseId(id));
  if (!caseData) notFound();

  const t = await getTranslations('case.form');
  const tc = await getTranslations('common');
  const locale = parseLocale(await getLocale());

  const [caseTypes, statuses, advisors, canSeeFinancials, financials] = await Promise.all([
    listCaseTypeOptions(),
    listCaseStatusOptions(),
    listAdvisorOptions(),
    isCurrentUserAdmin(),
    getCaseFinancials(asCaseId(caseData.id)),
  ]);

  const initialWithFinancials = {
    ...caseData,
    fee_amount: financials?.fee_amount ?? null,
    expected_income: financials?.expected_income ?? null,
  };

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <Link
          href={`/cases/${caseData.id}`}
          className="inline-flex items-center gap-1 text-sm text-neutral-500 hover:text-neutral-900 mb-3"
        >
          <BackArrow locale={locale} className="size-4" />
          {tc('back')}
        </Link>
        <h1 className="text-2xl font-light text-neutral-900 font-mono">
          {t('title.edit', { caseNumber: caseData.case_number })}
        </h1>
      </div>

      <div className="bg-white border border-neutral-200 rounded-lg p-6">
        <CaseForm
          mode="edit"
          initial={initialWithFinancials}
          caseTypes={caseTypes}
          statuses={statuses}
          advisors={advisors}
          canSeeFinancials={canSeeFinancials}
        />
      </div>
    </div>
  );
}
