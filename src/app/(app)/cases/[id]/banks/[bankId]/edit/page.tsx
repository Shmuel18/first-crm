import Link from 'next/link';
import { notFound } from 'next/navigation';

import { ArrowRight } from 'lucide-react';

import { CaseBankForm } from '@/features/case-banks/components/case-bank-form';
import { getCaseBankById } from '@/features/case-banks/services/case-banks.service';
import { getRawCaseById } from '@/features/cases/services/cases.service';
import { createClient } from '@/lib/supabase/server';

type Props = { params: Promise<{ id: string; bankId: string }> };

export default async function EditCaseBankPage({ params }: Props) {
  const { id, bankId } = await params;

  const [caseData, caseBank] = await Promise.all([
    getRawCaseById(id),
    getCaseBankById(bankId),
  ]);

  if (!caseData || !caseBank || caseBank.case_id !== id) notFound();

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
          עריכת בנק בתיק {caseData.case_number}
        </h1>
      </div>

      <div className="bg-white border border-neutral-200 rounded-lg p-6">
        <CaseBankForm
          caseId={id}
          initial={caseBank}
          banks={banksRes.data ?? []}
          statuses={statusesRes.data ?? []}
        />
      </div>
    </div>
  );
}
