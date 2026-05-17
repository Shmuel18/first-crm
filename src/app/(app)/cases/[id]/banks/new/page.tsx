import Link from 'next/link';
import { notFound } from 'next/navigation';

import { ArrowRight } from 'lucide-react';

import { CaseBankForm } from '@/features/case-banks/components/case-bank-form';
import { getRawCaseById } from '@/features/cases/services/cases.service';
import { createClient } from '@/lib/supabase/server';

type Props = { params: Promise<{ id: string }> };

export default async function NewCaseBankPage({ params }: Props) {
  const { id } = await params;
  const caseData = await getRawCaseById(id);
  if (!caseData) notFound();

  const supabase = await createClient();
  const [banksRes, statusesRes] = await Promise.all([
    supabase
      .from('banks')
      .select('id, name_he')
      .eq('is_active', true)
      .order('sort_order'),
    supabase
      .from('case_bank_statuses')
      .select('id, name_he')
      .eq('is_active', true)
      .order('sort_order'),
  ]);

  return (
    <div className="max-w-3xl space-y-6" dir="rtl">
      <div>
        <Link
          href={`/cases/${id}`}
          className="inline-flex items-center gap-1 text-sm text-neutral-500 hover:text-neutral-900 mb-3"
        >
          <ArrowRight className="size-4" />
          חזרה לתיק
        </Link>
        <h1 className="text-2xl font-light text-neutral-900 font-mono">
          הוסף בנק לתיק {caseData.case_number}
        </h1>
      </div>

      <div className="bg-white border border-neutral-200 rounded-lg p-6">
        <CaseBankForm
          caseId={id}
          banks={banksRes.data ?? []}
          statuses={statusesRes.data ?? []}
        />
      </div>
    </div>
  );
}
