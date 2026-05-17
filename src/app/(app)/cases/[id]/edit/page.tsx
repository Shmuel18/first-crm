import Link from 'next/link';
import { notFound } from 'next/navigation';

import { ArrowRight } from 'lucide-react';

import { CaseForm } from '@/features/cases/components/case-form';
import { getRawCaseById } from '@/features/cases/services/cases.service';
import { createClient } from '@/lib/supabase/server';

type Props = { params: Promise<{ id: string }> };

export default async function EditCasePage({ params }: Props) {
  const { id } = await params;
  const caseData = await getRawCaseById(id);
  if (!caseData) notFound();

  const supabase = await createClient();
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
    <div className="max-w-3xl space-y-6" dir="rtl">
      <div>
        <Link
          href={`/cases/${caseData.id}`}
          className="inline-flex items-center gap-1 text-sm text-neutral-500 hover:text-neutral-900 mb-3"
        >
          <ArrowRight className="size-4" />
          חזרה לתיק
        </Link>
        <h1 className="text-2xl font-light text-neutral-900 font-mono">
          עריכת תיק {caseData.case_number}
        </h1>
      </div>

      <div className="bg-white border border-neutral-200 rounded-lg p-6">
        <CaseForm
          mode="edit"
          initial={caseData}
          caseTypes={caseTypesRes.data ?? []}
          statuses={statusesRes.data ?? []}
          advisors={advisorsRes.data ?? []}
          canSeeFinancials={canSeeFinancials}
        />
      </div>
    </div>
  );
}
