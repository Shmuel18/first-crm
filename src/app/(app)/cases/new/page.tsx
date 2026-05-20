import Link from 'next/link';

import { getLocale, getTranslations } from 'next-intl/server';

import { BackArrow } from '@/components/shared/back-arrow';
import { CaseForm } from '@/features/cases/components/case-form';
import {
  listAdvisorOptions,
  listCaseStatusOptions,
  listCaseTypeOptions,
} from '@/features/cases/services/case-lookups.service';
import { isCurrentUserAdmin } from '@/lib/auth/permissions';
import type { Locale } from '@/lib/i18n/direction';

export default async function NewCasePage() {
  const t = await getTranslations('case.form');
  const tc = await getTranslations('common');
  const locale = (await getLocale()) as Locale;

  const [caseTypes, statuses, advisors, canSeeFinancials] = await Promise.all([
    listCaseTypeOptions(),
    listCaseStatusOptions(),
    listAdvisorOptions(),
    isCurrentUserAdmin(),
  ]);

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <Link
          href="/cases"
          className="inline-flex items-center gap-1 text-sm text-neutral-500 hover:text-neutral-900 mb-3"
        >
          <BackArrow locale={locale} className="size-4" />
          {tc('back')}
        </Link>
        <h1 className="text-2xl font-light text-neutral-900">{t('title.create')}</h1>
      </div>

      <div className="bg-white border border-neutral-200 rounded-lg p-6">
        <CaseForm
          mode="create"
          caseTypes={caseTypes}
          statuses={statuses}
          advisors={advisors}
          canSeeFinancials={canSeeFinancials}
        />
      </div>
    </div>
  );
}
