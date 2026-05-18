import Link from 'next/link';

import { getLocale, getTranslations } from 'next-intl/server';

import { BackArrow } from '@/components/shared/back-arrow';
import { CaseForm } from '@/features/cases/components/case-form';
import { createClient } from '@/lib/supabase/server';
import type { Locale } from '@/lib/i18n/direction';

export default async function NewCasePage() {
  const supabase = await createClient();
  const t = await getTranslations('case.form');
  const tc = await getTranslations('common');
  const locale = (await getLocale()) as Locale;

  const [caseTypesRes, statusesRes, advisorsRes, isAdminRes] = await Promise.all([
    supabase
      .from('case_types')
      .select('id, name_he')
      .eq('is_active', true)
      .order('sort_order'),
    supabase
      .from('case_statuses')
      .select('id, name_he')
      .eq('is_active', true)
      .order('sort_order'),
    supabase
      .from('profiles')
      .select('id, first_name, last_name')
      .eq('is_active', true)
      .order('first_name'),
    supabase.rpc('is_admin'),
  ]);

  const canSeeFinancials = isAdminRes.data === true;

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
          caseTypes={caseTypesRes.data ?? []}
          statuses={statusesRes.data ?? []}
          advisors={advisorsRes.data ?? []}
          canSeeFinancials={canSeeFinancials}
        />
      </div>
    </div>
  );
}
