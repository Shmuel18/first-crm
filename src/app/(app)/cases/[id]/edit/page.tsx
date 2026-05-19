import Link from 'next/link';
import { notFound } from 'next/navigation';

import { ArrowRight } from 'lucide-react';
import { getTranslations } from 'next-intl/server';

import { CaseForm } from '@/features/cases/components/case-form';
import { getRawCaseById } from '@/features/cases/services/cases.service';
import { createClient } from '@/lib/supabase/server';
import { asCaseId } from '@/lib/types/branded';

type Props = { params: Promise<{ id: string }> };

export default async function EditCasePage({ params }: Props) {
  const { id } = await params;
  const caseData = await getRawCaseById(asCaseId(id));
  if (!caseData) notFound();

  const t = await getTranslations('case.form');
  const tc = await getTranslations('common');

  const supabase = await createClient();
  const [caseTypesRes, statusesRes, advisorsRes, isAdminRes, financialsRes] = await Promise.all([
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
    // Manager-only fee / expected income live in case_financials (admin RLS)
    // - non-admins simply get an empty row here.
    supabase
      .from('case_financials')
      .select('fee_amount, expected_income')
      .eq('case_id', caseData.id)
      .maybeSingle(),
  ]);

  const canSeeFinancials = isAdminRes.data === true;
  const initialWithFinancials = {
    ...caseData,
    fee_amount: financialsRes.data?.fee_amount ?? null,
    expected_income: financialsRes.data?.expected_income ?? null,
  };

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <Link
          href={`/cases/${caseData.id}`}
          className="inline-flex items-center gap-1 text-sm text-neutral-500 hover:text-neutral-900 mb-3"
        >
          <ArrowRight className="size-4" />
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
          caseTypes={caseTypesRes.data ?? []}
          statuses={statusesRes.data ?? []}
          advisors={advisorsRes.data ?? []}
          canSeeFinancials={canSeeFinancials}
        />
      </div>
    </div>
  );
}
